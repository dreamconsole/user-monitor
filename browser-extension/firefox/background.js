// Firefox background script -- loaded after tab-tracker.js and native-messaging.js

tabTracker.start();
nativeClient.init();

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tab-tracker-flush') {
        const entries = tabTracker.flush();
        if (entries.length > 0) {
            nativeClient.sendActivity(entries);
        }
    }
    if (alarm.name === 'extension-heartbeat') {
        nativeClient.sendHeartbeat();
    }
});

browser.alarms.create('extension-heartbeat', { periodInMinutes: 2 });
