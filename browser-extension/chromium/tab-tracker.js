/**
 * TabTracker -- tracks active tab changes, domains visited, and time spent per tab.
 * Domain-only tracking for privacy compliance.
 */

const IDLE_THRESHOLD_SECONDS = 120;
const FLUSH_INTERVAL_MS = 30000; // Send accumulated data every 30s

class TabTracker {
    constructor() {
        this.currentEntry = null;
        this.pendingEntries = [];
        this.idleState = 'active';
        this.browserName = this._detectBrowser();
    }

    _detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Edg/')) return 'edge';
        if (ua.includes('Brave')) return 'brave';
        if (ua.includes('OPR/') || ua.includes('Opera')) return 'opera';
        if (ua.includes('Chrome/')) return 'chrome';
        return 'chromium';
    }

    _extractDomain(url) {
        if (!url) return null;
        try {
            // Skip internal browser pages
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
                url.startsWith('edge://') || url.startsWith('brave://') ||
                url.startsWith('opera://') || url.startsWith('about:')) {
                return null;
            }
            const parsed = new URL(url);
            return parsed.hostname;
        } catch {
            return null;
        }
    }

    start() {
        // Tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this._onTabSwitch(activeInfo.tabId);
        });

        // Tab URL updates (navigation within same tab)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.active) {
                this._onTabSwitch(tabId);
            }
        });

        // Window focus change
        chrome.windows.onFocusChanged.addListener((windowId) => {
            if (windowId === chrome.windows.WINDOW_ID_NONE) {
                this._finalizeCurrentEntry();
            } else {
                chrome.tabs.query({ active: true, windowId }, (tabs) => {
                    if (tabs[0]) this._onTabSwitch(tabs[0].id);
                });
            }
        });

        // Idle state
        chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
        chrome.idle.onStateChanged.addListener((state) => {
            this.idleState = state;
            if (state === 'idle' || state === 'locked') {
                this._finalizeCurrentEntry();
            } else if (state === 'active') {
                // Re-check current tab when user returns
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) this._onTabSwitch(tabs[0].id);
                });
            }
        });

        // Periodic flush alarm
        chrome.alarms.create('tab-tracker-flush', { periodInMinutes: 0.5 });

        // Initial check
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) this._onTabSwitch(tabs[0].id);
        });
    }

    async _onTabSwitch(tabId) {
        if (this.idleState !== 'active') return;

        try {
            const tab = await chrome.tabs.get(tabId);
            const domain = this._extractDomain(tab.url);

            // Skip if same domain (just title change within same site)
            if (this.currentEntry && this.currentEntry.domain === domain && domain !== null) {
                this.currentEntry.title = tab.title || this.currentEntry.title;
                return;
            }

            this._finalizeCurrentEntry();

            if (!domain) return; // Internal page, don't track

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

        // Only log entries > 1 second
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

    /**
     * Flush pending entries and return them. Clears the buffer.
     */
    flush() {
        this._finalizeCurrentEntry();
        const entries = [...this.pendingEntries];
        this.pendingEntries = [];

        // Re-start tracking current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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

// Export singleton
self.tabTracker = new TabTracker();
