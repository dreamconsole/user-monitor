self.MonitorService = {
    isTracking: false,
    currentState: 'OFFLINE', // OFFLINE, ACTIVE, IDLE, BREAK
    sessionId: null,
    orgId: null,
    userId: null,

    // Session Accumulators
    startTime: null,
    totalWorkSeconds: 0,
    totalIdleSeconds: 0,
    totalBreakSeconds: 0,
    lastCheckTime: 0,

    // Tab tracking
    activeUrl: null,
    activeTitle: null,
    idleState: 'active',

    async start() {
        if (this.isTracking) return;
        const result = await chrome.storage.local.get(['user']);
        if (!result.user) return console.error('MonitorService: No user found');

        console.log('MonitorService: Starting Shift');
        this.orgId = result.user.org_id;
        this.userId = result.user.id;
        this.isTracking = true;
        this.currentState = 'ACTIVE';
        this.sessionId = self.crypto.randomUUID();
        this.startTime = Date.now();
        this.lastCheckTime = Date.now();

        this.totalWorkSeconds = 0;
        this.totalIdleSeconds = 0;
        this.totalBreakSeconds = 0;

        await this.saveState();

        // Listeners for activity
        chrome.idle.onStateChanged.addListener(this.handleIdleStateChanged.bind(this));
        chrome.tabs.onActivated.addListener(this.checkActiveTab.bind(this));
        chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
            if (change.status === 'complete') this.checkActiveTab();
        });

        // Background update alarm (every 1 minute like Electron POLL_INTERVAL_MS)
        chrome.alarms.create('monitor-poll', { periodInMinutes: 1 });

        this.checkActiveTab();
        console.log('MonitorService: Shift started', this.sessionId);
    },

    async stop() {
        console.log('MonitorService: Ending Shift');
        this.updateTotals();
        this.isTracking = false;
        this.currentState = 'OFFLINE';
        chrome.alarms.clear('monitor-poll');
        await this.saveState();
        if (self.SyncService) self.SyncService.sendHeartbeat(); // Final sync
    },

    async pause(breakType) {
        if (this.currentState === 'BREAK') return;
        console.log('MonitorService: Taking break', breakType);
        this.updateTotals();
        this.currentState = 'BREAK';
        this.breakType = breakType;
        this.breakStartTime = Date.now();
        await this.saveState();
    },

    async resume() {
        if (this.currentState !== 'BREAK') return;
        console.log('MonitorService: Resuming work');
        const duration = Math.floor((Date.now() - this.breakStartTime) / 1000);
        this.totalBreakSeconds += duration;
        this.currentState = 'ACTIVE';
        this.lastCheckTime = Date.now();
        await this.saveState();
    },

    updateTotals() {
        if (this.currentState === 'OFFLINE') return;

        const now = Date.now();
        const secondsElapsed = Math.floor((now - this.lastCheckTime) / 1000);
        this.lastCheckTime = now;

        if (this.currentState === 'BREAK') {
            // Handled in resume, but if still on break:
            // this.totalBreakSeconds += secondsElapsed; -> Handled by breakStartTime
        } else if (this.idleState === 'idle') {
            this.totalIdleSeconds += secondsElapsed;
        } else {
            this.totalWorkSeconds += secondsElapsed;
        }
    },

    async handleIdleStateChanged(newState) {
        this.updateTotals();
        this.idleState = newState;
        if (this.currentState !== 'BREAK' && this.currentState !== 'OFFLINE') {
            this.currentState = (newState === 'active') ? 'ACTIVE' : 'IDLE';
        }
        await this.saveState();
    },

    async checkActiveTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                this.activeUrl = tab.url;
                this.activeTitle = tab.title;
            }
        } catch (e) { console.error(e); }
    },

    async saveState() {
        await chrome.storage.local.set({
            monitorState: {
                isTracking: this.isTracking,
                currentState: this.currentState,
                sessionId: this.sessionId,
                totalWorkSeconds: this.totalWorkSeconds,
                totalIdleSeconds: this.totalIdleSeconds,
                totalBreakSeconds: this.totalBreakSeconds,
                lastCheckTime: this.lastCheckTime,
                breakStartTime: this.breakStartTime,
                breakType: this.breakType
            }
        });
    }
};

// Background poll alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'monitor-poll') {
        MonitorService.updateTotals();
        MonitorService.saveState();
    }
});

// Control messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_SHIFT') {
        MonitorService.start();
        sendResponse({ success: true });
    } else if (message.type === 'END_SHIFT') {
        MonitorService.stop();
        sendResponse({ success: true });
    } else if (message.type === 'PAUSE_TRACKING') {
        MonitorService.pause(message.breakType || 'General Break');
        sendResponse({ success: true });
    } else if (message.type === 'RESUME_TRACKING') {
        MonitorService.resume();
        sendResponse({ success: true });
    }
});
