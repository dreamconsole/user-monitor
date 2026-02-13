const nativeTracker = require('./nativeTracker');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const POLL_INTERVAL_MS = 60000; // Check every 1 minute

class AppTracker {
    constructor() {
        this.interval = null;
        this.currentApp = null;
        this.currentAppStartTime = null;
        this.isTracking = false;
    }

    async start() {
        if (this.isTracking) {
            console.log('[AppTracker] Already tracking');
            return;
        }

        console.log('[AppTracker] Starting app tracking...');
        this.isTracking = true;

        // Get initial app
        await this.checkCurrentApp();

        // Poll for app changes
        this.interval = setInterval(async () => {
            await this.checkCurrentApp();
        }, POLL_INTERVAL_MS);
    }

    async checkCurrentApp() {
        try {
            const activeWindow = await nativeTracker.getActiveWindow();

            if (!activeWindow) {
                // No active window (e.g., screen locked) or tracking failed
                if (this.currentApp) {
                    await this.logAppSwitch(null);
                }
                return;
            }

            const { owner } = activeWindow;
            const executableName = owner.name;
            const windowTitle = activeWindow.title;

            // Check if app changed
            if (!this.currentApp || this.currentApp.executableName !== executableName) {
                // App switched
                await this.logAppSwitch({
                    executableName,
                    windowTitle
                });
            } else {
                // Same app, just update window title if needed
                this.currentApp.windowTitle = windowTitle;
            }
        } catch (error) {
            console.error('[AppTracker] Error checking current app:', error.message);
        }
    }

    async logAppSwitch(newApp) {
        // Log the previous app if it exists
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

        // Set new current app
        if (newApp) {
            this.currentApp = newApp;
            this.currentAppStartTime = new Date().toISOString();
        } else {
            this.currentApp = null;
            this.currentAppStartTime = null;
        }
    }

    stop() {
        if (!this.isTracking) {
            return;
        }

        console.log('[AppTracker] Stopping app tracking...');
        this.isTracking = false;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        // Log the current app before stopping
        if (this.currentApp) {
            this.logAppSwitch(null);
        }
    }
}

module.exports = new AppTracker();
