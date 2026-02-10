importScripts('config.js', 'services/auth.js', 'services/monitor.js', 'services/sync.js');

// Initialize services on installation or startup
chrome.runtime.onInstalled.addListener(() => {
    console.log('User Monitor Agent Extension installed');
});

// Recover state on startup
chrome.runtime.onStartup.addListener(initialization);

async function initialization() {
    console.log('Initializing User Monitor Agent...');
    const result = await chrome.storage.local.get(['token', 'user', 'monitorState']);

    if (result.token && result.user) {
        await AuthService.initialize(result.user, result.token);

        // Restore Monitor Service state
        if (result.monitorState && result.monitorState.isTracking) {
            Object.assign(MonitorService, result.monitorState);
            MonitorService.isTracking = true; // Ensure it's active
            MonitorService.lastCheckTime = Date.now(); // Reset check time

            // Re-setup listeners and alarms
            chrome.idle.onStateChanged.addListener(MonitorService.handleIdleStateChanged.bind(MonitorService));
            chrome.tabs.onActivated.addListener(MonitorService.checkActiveTab.bind(MonitorService));
            chrome.alarms.create('monitor-poll', { periodInMinutes: 1 });

            SyncService.start();
        }
    }
}

// Handle periodic sync and monitor polling
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync-heartbeat') {
        SyncService.sendHeartbeat();
    } else if (alarm.name === 'sync-screenshot') {
        SyncService.sendScreenshot();
    } else if (alarm.name === 'monitor-poll') {
        MonitorService.updateTotals();
        MonitorService.saveState();
    }
});

// Call initialization immediately on background load (e.g. extension refresh)
initialization();
