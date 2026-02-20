/**
 * TabTracker for Firefox -- uses browser.* API (WebExtensions)
 * Domain-only tracking for privacy compliance.
 */

const IDLE_THRESHOLD_SECONDS = 120;

class TabTracker {
    constructor() {
        this.currentEntry = null;
        this.pendingEntries = [];
        this.idleState = 'active';
        this.browserName = 'firefox';
    }

    _extractDomain(url) {
        if (!url) return null;
        try {
            if (url.startsWith('about:') || url.startsWith('moz-extension://') ||
                url.startsWith('file://')) {
                return null;
            }
            const parsed = new URL(url);
            return parsed.hostname;
        } catch {
            return null;
        }
    }

    start() {
        browser.tabs.onActivated.addListener((activeInfo) => {
            this._onTabSwitch(activeInfo.tabId);
        });

        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.active) {
                this._onTabSwitch(tabId);
            }
        });

        browser.windows.onFocusChanged.addListener((windowId) => {
            if (windowId === browser.windows.WINDOW_ID_NONE) {
                this._finalizeCurrentEntry();
            } else {
                browser.tabs.query({ active: true, windowId }).then((tabs) => {
                    if (tabs[0]) this._onTabSwitch(tabs[0].id);
                });
            }
        });

        browser.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
        browser.idle.onStateChanged.addListener((state) => {
            this.idleState = state;
            if (state === 'idle' || state === 'locked') {
                this._finalizeCurrentEntry();
            } else if (state === 'active') {
                browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
                    if (tabs[0]) this._onTabSwitch(tabs[0].id);
                });
            }
        });

        browser.alarms.create('tab-tracker-flush', { periodInMinutes: 0.5 });

        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs[0]) this._onTabSwitch(tabs[0].id);
        });
    }

    async _onTabSwitch(tabId) {
        if (this.idleState !== 'active') return;

        try {
            const tab = await browser.tabs.get(tabId);
            const domain = this._extractDomain(tab.url);

            if (this.currentEntry && this.currentEntry.domain === domain && domain !== null) {
                this.currentEntry.title = tab.title || this.currentEntry.title;
                return;
            }

            this._finalizeCurrentEntry();

            if (!domain) return;

            this.currentEntry = {
                domain,
                title: tab.title || '',
                start_time: new Date().toISOString(),
                browser: this.browserName
            };
        } catch (e) {
            // Tab may have been closed
        }
    }

    _finalizeCurrentEntry() {
        if (!this.currentEntry) return;

        const now = new Date();
        const start = new Date(this.currentEntry.start_time);
        const durationMs = now - start;

        if (durationMs < 1000) {
            this.currentEntry = null;
            return;
        }

        this.pendingEntries.push({
            browser: this.currentEntry.browser,
            domain: this.currentEntry.domain,
            title: this.currentEntry.title,
            start_time: this.currentEntry.start_time,
            end_time: now.toISOString(),
            duration: Math.round(durationMs / 1000)
        });

        this.currentEntry = null;
    }

    flush() {
        this._finalizeCurrentEntry();
        const entries = [...this.pendingEntries];
        this.pendingEntries = [];

        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs[0]) {
                const domain = this._extractDomain(tabs[0].url);
                if (domain) {
                    this.currentEntry = {
                        domain,
                        title: tabs[0].title || '',
                        start_time: new Date().toISOString(),
                        browser: this.browserName
                    };
                }
            }
        });

        return entries;
    }
}

// Firefox global scope
var tabTracker = new TabTracker();
