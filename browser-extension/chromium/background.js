importScripts('tab-tracker.js', 'native-messaging.js');

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[UserMonitor] Extension installed');
    self.tabTracker.start();
    self.nativeClient.init();
});

// Recover on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[UserMonitor] Browser started');
    self.tabTracker.start();
    self.nativeClient.init();
});

// Initialize immediately (handles extension reload/update)
self.tabTracker.start();
self.nativeClient.init();

// Alarm handler -- flush tracked data and send to agent
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tab-tracker-flush') {
        const entries = self.tabTracker.flush();
        if (entries.length > 0) {
            self.nativeClient.sendActivity(entries);
        }
    }
    if (alarm.name === 'extension-heartbeat') {
        self.nativeClient.sendHeartbeat();
    }
});

// Heartbeat alarm -- every 2 minutes
chrome.alarms.create('extension-heartbeat', { periodInMinutes: 2 });
