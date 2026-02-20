const nativeTracker = require('./nativeTracker');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const POLL_INTERVAL_MS = 60000;

// Map executable names / process names to browser keys
// Covers all major browsers + common new ones
const BROWSER_PROCESS_MAP = {
    // Chromium-based
    'chrome.exe': 'chrome', 'chrome': 'chrome', 'google-chrome': 'chrome', 'google-chrome-stable': 'chrome',
    'msedge.exe': 'edge', 'msedge': 'edge', 'microsoft-edge': 'edge',
    'brave.exe': 'brave', 'brave': 'brave', 'brave-browser': 'brave',
    'opera.exe': 'opera', 'opera': 'opera',
    'vivaldi.exe': 'vivaldi', 'vivaldi': 'vivaldi',
    'arc.exe': 'arc', 'arc': 'arc',
    'yandex.exe': 'yandex', 'browser.exe': 'yandex',
    'whale.exe': 'whale', 'whale': 'whale',
    'chromium.exe': 'chromium', 'chromium': 'chromium', 'chromium-browser': 'chromium',
    'duckduckgo.exe': 'duckduckgo',
    'maxthon.exe': 'maxthon', 'maxthon': 'maxthon',
    'samsung internet': 'samsung',
    // Firefox-based
    'firefox.exe': 'firefox', 'firefox': 'firefox',
    'waterfox.exe': 'waterfox', 'waterfox': 'waterfox',
    'librewolf.exe': 'librewolf', 'librewolf': 'librewolf',
    'floorp.exe': 'floorp', 'floorp': 'floorp',
    'tor browser': 'tor',
};

// Display name patterns for PowerShell fallback (process.Name returns display names)
const BROWSER_DISPLAY_PATTERNS = [
    { pattern: 'google chrome', key: 'chrome' },
    { pattern: 'microsoft edge', key: 'edge' },
    { pattern: 'opera internet browser', key: 'opera' },
    { pattern: 'opera gx', key: 'opera' },
    { pattern: 'brave browser', key: 'brave' },
    { pattern: 'vivaldi', key: 'vivaldi' },
    { pattern: 'arc', key: 'arc' },
    { pattern: 'mozilla firefox', key: 'firefox' },
    { pattern: 'waterfox', key: 'waterfox' },
    { pattern: 'librewolf', key: 'librewolf' },
    { pattern: 'duckduckgo', key: 'duckduckgo' },
    { pattern: 'yandex browser', key: 'yandex' },
    { pattern: 'samsung internet', key: 'samsung' },
    { pattern: 'maxthon', key: 'maxthon' },
    { pattern: 'tor browser', key: 'tor' },
    { pattern: 'floorp', key: 'floorp' },
    { pattern: 'whale', key: 'whale' },
    { pattern: 'chromium', key: 'chromium' },
];

function getBrowserKey(executableName) {
    if (!executableName) return null;
    const lower = executableName.toLowerCase().trim();

    // Exact match first
    if (BROWSER_PROCESS_MAP[lower]) return BROWSER_PROCESS_MAP[lower];

    // Display name pattern match
    for (const { pattern, key } of BROWSER_DISPLAY_PATTERNS) {
        if (lower.includes(pattern)) return key;
    }

    return null;
}

/**
 * Parse the window title to extract a meaningful page title.
 * Most browsers use: "Page Title - Browser Name" or "Page Title — Browser Name"
 */
function parseWindowTitle(windowTitle, browserKey) {
    if (!windowTitle) return null;

    // Common separators browsers use before the browser name
    const separators = [' - ', ' — ', ' – ', ' | '];

    for (const sep of separators) {
        const lastIdx = windowTitle.lastIndexOf(sep);
        if (lastIdx > 0) {
            const beforeSep = windowTitle.substring(0, lastIdx).trim();
            const afterSep = windowTitle.substring(lastIdx + sep.length).trim().toLowerCase();

            // Check if the part after separator is the browser name
            if (BROWSER_DISPLAY_PATTERNS.some(b => afterSep.includes(b.pattern)) ||
                afterSep.includes(browserKey)) {
                return beforeSep || null;
            }
        }
    }

    // If no separator matched, return the full title (minus common suffixes)
    return windowTitle.trim() || null;
}

class AppTracker {
    constructor() {
        this.interval = null;
        this.currentApp = null;
        this.currentAppStartTime = null;
        this.isTracking = false;
        // For browser window title tracking
        this.currentBrowserTitle = null;
        this.currentBrowserKey = null;
        this.currentBrowserTitleStartTime = null;
    }

    async start() {
        if (this.isTracking) {
            console.log('[AppTracker] Already tracking');
            return;
        }

        console.log('[AppTracker] Starting app tracking (hybrid browser mode)...');
        this.isTracking = true;

        await this.checkCurrentApp();

        this.interval = setInterval(async () => {
            await this.checkCurrentApp();
        }, POLL_INTERVAL_MS);
    }

    async checkCurrentApp() {
        try {
            const activeWindow = await nativeTracker.getActiveWindow();

            if (!activeWindow) {
                if (this.currentApp) {
                    await this.logAppSwitch(null);
                }
                this._finalizeBrowserTitle();
                return;
            }

            const { owner } = activeWindow;
            const executableName = owner.name;
            const windowTitle = activeWindow.title;

            // Check if app changed
            if (!this.currentApp || this.currentApp.executableName !== executableName) {
                await this.logAppSwitch({
                    executableName,
                    windowTitle
                });
            } else {
                this.currentApp.windowTitle = windowTitle;
            }

            // Hybrid browser tracking: if this is a browser, track window title
            const browserKey = getBrowserKey(executableName);
            if (browserKey) {
                this._trackBrowserWindowTitle(browserKey, windowTitle);
            } else {
                this._finalizeBrowserTitle();
            }
        } catch (error) {
            console.error('[AppTracker] Error checking current app:', error.message);
        }
    }

    /**
     * Track browser window title changes. Only logs if no extension is active for this browser.
     */
    _trackBrowserWindowTitle(browserKey, windowTitle) {
        const pageTitle = parseWindowTitle(windowTitle, browserKey);

        // Title hasn't changed, nothing to do
        if (this.currentBrowserKey === browserKey && this.currentBrowserTitle === pageTitle) {
            return;
        }

        // Finalize previous browser title entry
        this._finalizeBrowserTitle();

        if (!pageTitle || pageTitle === 'New Tab' || pageTitle === 'New tab') return;

        this.currentBrowserKey = browserKey;
        this.currentBrowserTitle = pageTitle;
        this.currentBrowserTitleStartTime = new Date().toISOString();
    }

    _finalizeBrowserTitle() {
        if (!this.currentBrowserKey || !this.currentBrowserTitleStartTime) {
            this.currentBrowserKey = null;
            this.currentBrowserTitle = null;
            this.currentBrowserTitleStartTime = null;
            return;
        }

        // Check if extension is handling this browser
        try {
            const browserActivityService = require('./browserActivityService');
            if (browserActivityService.hasActiveExtension(this.currentBrowserKey)) {
                // Extension is active, skip window title tracking for this browser
                this.currentBrowserKey = null;
                this.currentBrowserTitle = null;
                this.currentBrowserTitleStartTime = null;
                return;
            }
        } catch {}

        const now = new Date();
        const start = new Date(this.currentBrowserTitleStartTime);
        const durationSeconds = Math.floor((now - start) / 1000);

        if (durationSeconds < 2) {
            this.currentBrowserKey = null;
            this.currentBrowserTitle = null;
            this.currentBrowserTitleStartTime = null;
            return;
        }

        // Only insert if DB is ready
        if (db.isInitialized()) {
            try {
                const authService = require('./auth');
                const user = authService.getUser();

                db.insertBrowserActivityLog({
                    user_id: user ? user.id : null,
                    org_id: user ? user.org_id : null,
                    browser: this.currentBrowserKey,
                    domain: null,
                    title: this.currentBrowserTitle,
                    start_time: this.currentBrowserTitleStartTime,
                    end_time: now.toISOString(),
                    duration_seconds: durationSeconds,
                    source: 'window_title'
                });

                console.log(`[AppTracker] Browser title logged: "${this.currentBrowserTitle}" on ${this.currentBrowserKey} (${durationSeconds}s)`);
            } catch (e) {
                console.error('[AppTracker] Failed to log browser title:', e.message);
            }
        }

        this.currentBrowserKey = null;
        this.currentBrowserTitle = null;
        this.currentBrowserTitleStartTime = null;
    }

    async logAppSwitch(newApp) {
        if (this.currentApp && this.currentAppStartTime) {
            const endTime = new Date().toISOString();
            const startTime = this.currentAppStartTime;
            const durationSeconds = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);

            if (durationSeconds > 0) {
                const logId = uuidv4();
                db.insertAppUsageLog({
                    id: logId,
                    app_name: this.currentApp.executableName,
                    executable_name: this.currentApp.executableName,
                    window_title: this.currentApp.windowTitle,
                    start_time: startTime,
                    end_time: endTime,
                    duration_seconds: durationSeconds,
                    synced: 0
                });

                console.log(`[AppTracker] Logged: ${this.currentApp.executableName} (${durationSeconds}s)`);
            }
        }

        if (newApp) {
            this.currentApp = newApp;
            this.currentAppStartTime = new Date().toISOString();
        } else {
            this.currentApp = null;
            this.currentAppStartTime = null;
        }
    }

    stop() {
        if (!this.isTracking) return;

        console.log('[AppTracker] Stopping app tracking...');
        this.isTracking = false;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (this.currentApp) {
            this.logAppSwitch(null);
        }
        this._finalizeBrowserTitle();
    }
}

module.exports = new AppTracker();
