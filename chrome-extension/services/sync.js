self.SyncService = {
    heartbeatInterval: 1, // minutes
    screenshotInterval: 5, // minutes

    start() {
        console.log('SyncService: Starting');
        chrome.alarms.create('sync-heartbeat', { periodInMinutes: this.heartbeatInterval });
        chrome.alarms.create('sync-screenshot', { periodInMinutes: this.screenshotInterval });
    },

    stop() {
        console.log('SyncService: Stopping');
        chrome.alarms.clear('sync-heartbeat');
        chrome.alarms.clear('sync-screenshot');
    },

    async sendHeartbeat() {
        if (!AuthService.isAuthenticated()) return;

        // 1. Send Heartbeat ping
        try {
            const user = AuthService.getUser();
            await fetch(`${CONFIG.API_URL}/agent/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AuthService.getToken()}`
                },
                body: JSON.stringify({
                    org_id: user.org_id,
                    user_id: user.id,
                    device_identifier: AuthService.getDeviceId(),
                    status: MonitorService.currentState.toLowerCase(),
                    last_seen_at: new Date().toISOString()
                })
            });
        } catch (e) { console.error('Heartbeat failed:', e); }

        // 2. Send Activity Session update (Shift data)
        const isStopping = !MonitorService.isTracking;
        if (MonitorService.isTracking || isStopping) {
            try {
                // Map internal state to session_status enum: active, completed, abandoned, force_logged_out
                let sessionStatus = 'active';
                if (isStopping) {
                    sessionStatus = 'completed';
                } else {
                    // Even if IDLE or BREAK, the "session" is still active in Postgres enum
                    sessionStatus = 'active';
                }

                const user = AuthService.getUser();
                await fetch(`${CONFIG.API_URL}/agent/activity-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AuthService.getToken()}`
                    },
                    body: JSON.stringify({
                        id: MonitorService.sessionId,
                        org_id: user.org_id,
                        user_id: user.id,
                        start_time: new Date(MonitorService.startTime).toISOString(),
                        end_time: new Date().toISOString(),
                        total_work_seconds: MonitorService.totalWorkSeconds,
                        total_idle_seconds: MonitorService.totalIdleSeconds,
                        total_break_seconds: MonitorService.totalBreakSeconds,
                        status: sessionStatus
                    })
                });
            } catch (e) { console.error('Session sync failed:', e); }
        }

        // 3. Send Activity Log (Current status)
        if (MonitorService.isTracking && MonitorService.currentState !== 'BREAK') {
            try {
                const user = AuthService.getUser();
                await fetch(`${CONFIG.API_URL}/agent/activity-log`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AuthService.getToken()}`
                    },
                    body: JSON.stringify({
                        org_id: user.org_id,
                        user_id: user.id,
                        session_id: MonitorService.sessionId,
                        log_time: new Date().toISOString(),
                        keyboard_events: 0,
                        mouse_events: 0,
                        state: MonitorService.idleState === 'active' ? 'active' : 'idle',
                        metadata: {
                            url: MonitorService.activeUrl,
                            title: MonitorService.activeTitle
                        }
                    })
                });
            } catch (e) { console.error('Activity log failed:', e); }
        }
    },

    async sendScreenshot() {
        if (!AuthService.isAuthenticated()) return;
        if (!MonitorService.isTracking || MonitorService.currentState !== 'ACTIVE') return;

        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 });
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            const user = AuthService.getUser();
            const formData = new FormData();
            formData.append('screenshot', blob, 'screenshot.jpg');
            formData.append('org_id', user.org_id);
            formData.append('user_id', user.id);
            formData.append('session_id', MonitorService.sessionId || '');
            formData.append('captured_at', new Date().toISOString());

            await fetch(`${CONFIG.API_URL}/agent/screenshot`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AuthService.getToken()}` },
                body: formData
            });
        } catch (error) { console.error('Screenshot failed:', error); }
    }
};
