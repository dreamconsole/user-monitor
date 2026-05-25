const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const db = require('../db');
const authService = require('./auth');
const { API_URL } = require('../config');
// Circular dependency warning: monitor requires sync? No, monitor requires screenshot, screenshot requires db.
// sync requires monitor? No, sync reads DB.
// But sync needs current session ID from monitor.
// To avoid circular dependency issues at top level if any, we can require inside the method or ensure clean architecture.
// monitor.js exports an instance.
const monitorService = require('./monitor');
const logger = require('./logger');

const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes default

class SyncService {
    constructor() {
        this.interval = null;
        this.heartbeatTimer = null;
        this.isSyncing = false;
        this.currentIntervalMs = DEFAULT_SYNC_INTERVAL_MS;

        const configService = require('./config');
        configService.on('config-updated', (cfg) => this.applyIntervalFromConfig(cfg));
    }

    applyIntervalFromConfig(cfg) {
        const configService = require('./config');
        const sec = parseInt(
            cfg?.heartbeat_interval_seconds ?? configService.get('heartbeat_interval_seconds'),
            10
        );
        if (!Number.isFinite(sec) || sec < 30) return;

        const ms = sec * 1000;
        if (this.currentIntervalMs !== ms) {
            this.resetInterval(ms);
        }
        this.restartHeartbeatTimer(ms);
    }

    restartHeartbeatTimer(intervalMs) {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        const ms = intervalMs || this.currentIntervalMs;
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, ms);
        console.log(`[SyncService] Presence heartbeat every ${ms / 1000}s`);
    }

    start() {
        if (this.interval) return; // Already running

        console.log('Starting Sync Service...');
        this.applyIntervalFromConfig(require('./config').getAll());
        this.resetInterval(this.currentIntervalMs);
        this.restartHeartbeatTimer(this.currentIntervalMs);
    }

    resetInterval(newIntervalMs) {
        if (this.interval) clearInterval(this.interval);

        this.currentIntervalMs = newIntervalMs;
        console.log(`Sync Service interval set to ${this.currentIntervalMs / 1000}s.`);

        this.interval = setInterval(() => {
            this.sync();
        }, this.currentIntervalMs);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        console.log('Sync Service stopped.');
    }

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            await this.syncWorkSessions();
            await this.syncActivityLogs();
            await this.syncBreakLogs();
            await this.syncScreenshots();
            await this.syncAppUsageLogs();
            await this.syncBrowserActivityLogs();
            await this.sendHeartbeat();
        } catch (error) {
            console.error('Sync failed:', error.message);
            logger.error('Sync process failed', error);
        } finally {
            this.isSyncing = false;
        }
    }

    async syncWorkSessions() {
        const rows = db.getDB().prepare(`
            SELECT * FROM work_sessions WHERE sync_status = 'pending' LIMIT 5
        `).all();

        for (const row of rows) {
            try {
                const shiftEnded = row.end_time != null && row.end_time > 0;
                const response = await axios.post(`${API_URL}/agent/activity-session`, {
                    id: row.id,
                    org_id: row.org_id,
                    user_id: row.user_id,
                    start_time: new Date(row.start_time).toISOString(),
                    end_time: shiftEnded ? new Date(row.end_time).toISOString() : null,
                    shift_ended: shiftEnded,
                    total_work_seconds: row.total_work_seconds,
                    total_idle_seconds: row.total_idle_seconds,
                    total_break_seconds: row.total_break_seconds,
                    campaign_id: row.campaign_id || null,
                    status: shiftEnded ? 'completed' : 'active',
                }, {
                    headers: { Authorization: `Bearer ${authService.getToken()}` }
                });

                this.checkForForcedLogout(response);

                if (response.data && response.data.success) {
                    db.getDB().prepare(`
                        UPDATE work_sessions SET sync_status = 'synced' WHERE id = ?
                    `).run(row.id);
                    console.log(`Synced work session: ${row.id}`);
                } else {
                    console.warn(`Work session sync returned failure for ${row.id}:`, response.data);
                }
            } catch (error) {
                console.error(`Failed to sync work session ${row.id}`, error.message);
                this.checkForForcedLogout(error.response);
            }
        }
    }

    async syncActivityLogs() {
        const rows = db.getDB().prepare(`
            SELECT * FROM activity_logs WHERE sync_status = 'pending' LIMIT 50
        `).all();

        for (const row of rows) {
            try {
                const response = await axios.post(`${API_URL}/agent/activity-log`, {
                    session_id: row.session_id,
                    org_id: row.org_id,
                    user_id: row.user_id,
                    log_time: new Date(row.log_time).toISOString(),
                    keyboard_events: row.keyboard_events,
                    mouse_events: row.mouse_events,
                    left_clicks: row.left_clicks || 0,
                    right_clicks: row.right_clicks || 0,
                    state: row.state,
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                }, {
                    headers: { Authorization: `Bearer ${authService.getToken()}` }
                });

                this.checkForForcedLogout(response);

                if (response.data && response.data.success) {
                    db.getDB().prepare(`
                        UPDATE activity_logs SET sync_status = 'synced' WHERE id = ?
                    `).run(row.id);
                    console.log(`Synced activity log: ${row.id}`);
                } else {
                    console.warn(`Activity log sync returned failure for ${row.id}:`, response.data);
                }
            } catch (error) {
                console.error(`Failed to sync activity log ${row.id}`, error.message);
                this.checkForForcedLogout(error.response);
            }
        }
    }

    async syncBreakLogs() {
        const rows = db.getDB().prepare(`
            SELECT * FROM break_logs WHERE sync_status = 'pending' LIMIT 50
        `).all();

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        for (const row of rows) {
            try {
                let breakTypeId = row.break_type_id;
                // Server will handle name-to-UUID resolution if it's not a UUID

                const response = await axios.post(`${API_URL}/agent/break-log`, {
                    id: row.id,
                    org_id: row.org_id,
                    user_id: row.user_id,
                    session_id: row.session_id,
                    break_type_id: breakTypeId,
                    start_time: new Date(row.start_time).toISOString(),
                    end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
                    duration_seconds: row.duration_seconds
                }, {
                    headers: { Authorization: `Bearer ${authService.getToken()}` }
                });

                this.checkForForcedLogout(response);

                if (response.data && response.data.success) {
                    db.getDB().prepare(`
                        UPDATE break_logs SET sync_status = 'synced' WHERE id = ?
                    `).run(row.id);
                    console.log(`Synced break log: ${row.id}`);
                } else {
                    console.warn(`Break log sync returned failure for ${row.id}:`, response.data);
                }
            } catch (error) {
                console.error(`Failed to sync break log ${row.id}`, error.message);
                this.checkForForcedLogout(error.response);
            }
        }
    }

    async syncScreenshots() {
        const rows = db.getDB().prepare(`
            SELECT * FROM screenshots WHERE sync_status = 'pending' LIMIT 5
        `).all();

        for (const row of rows) {
            try {
                if (!fs.existsSync(row.file_path)) {
                    console.error(`Screenshot file missing: ${row.file_path}`);
                    continue;
                }

                const form = new FormData();
                form.append('org_id', row.org_id);
                form.append('user_id', row.user_id);
                form.append('device_id', row.device_id);
                form.append('session_id', row.session_id || '');
                form.append('captured_at', new Date(row.captured_at).toISOString());
                form.append('screenshot', fs.createReadStream(row.file_path));

                const response = await axios.post(`${API_URL}/agent/screenshot`, form, {
                    headers: {
                        Authorization: `Bearer ${authService.getToken()}`,
                        ...form.getHeaders()
                    }
                });

                this.checkForForcedLogout(response);

                if (response.data && response.data.success) {
                    db.getDB().prepare(`
                        UPDATE screenshots SET sync_status = 'uploaded' WHERE id = ?
                    `).run(row.id);
                    fs.unlinkSync(row.file_path);
                    console.log(`Synced screenshot: ${row.id}`);
                } else {
                    console.warn(`Screenshot sync returned failure for ${row.id}:`, response.data);
                }
            } catch (error) {
                console.error(`Failed to sync screenshot ${row.id}`, error.message);
                this.checkForForcedLogout(error.response);
            }
        }
    }

    async syncAppUsageLogs() {
        const logs = db.getUnsyncedAppUsageLogs();

        if (logs.length === 0) return;

        try {
            const response = await axios.post(`${API_URL}/app-tracking/usage/log`, {
                logs: logs.map(log => ({
                    executable_name: log.executable_name,
                    window_title: log.window_title,
                    start_time: log.start_time,
                    end_time: log.end_time,
                    duration_seconds: log.duration_seconds
                }))
            }, {
                headers: { Authorization: `Bearer ${authService.getToken()}` }
            });

            this.checkForForcedLogout(response);

            if (response.data) {
                // Mark logs as synced
                const ids = logs.map(log => log.id);
                db.markAppUsageLogsSynced(ids);
                console.log(`Synced ${logs.length} app usage logs`);
            }
        } catch (error) {
            console.error('Failed to sync app usage logs:', error.message);
            this.checkForForcedLogout(error.response);
        }
    }

    async syncBrowserActivityLogs() {
        const logs = db.getUnsyncedBrowserActivityLogs();
        if (logs.length === 0) return;

        try {
            const response = await axios.post(`${API_URL}/agent/browser-activity`, {
                logs: logs.map(log => ({
                    browser: log.browser,
                    domain: log.domain || null,
                    title: log.title,
                    start_time: log.start_time,
                    end_time: log.end_time,
                    duration_seconds: log.duration_seconds,
                    source: log.source || 'extension'
                }))
            }, {
                headers: { Authorization: `Bearer ${authService.getToken()}` }
            });

            this.checkForForcedLogout(response);

            if (response.data) {
                const ids = logs.map(log => log.id);
                db.markBrowserActivityLogsSynced(ids);
                console.log(`Synced ${logs.length} browser activity logs`);
            }
        } catch (error) {
            console.error('Failed to sync browser activity logs:', error.message);
            this.checkForForcedLogout(error.response);
        }
    }

    /** After login / auto-login: clear stale CRM online without touching activity sync (legacy APIs treat that as live activity). */
    async clearStalePresence() {
        const cleared = await this.sendShiftOffline();
        if (!cleared) {
            await this.clearPresenceViaAuthMe();
        }
    }

    /** Fallback when shift-offline is not deployed yet (requires server with GET /auth/me?client=agent). */
    async clearPresenceViaAuthMe() {
        const token = authService.getToken();
        if (!token) return;
        try {
            await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { client: 'agent' },
            });
            console.log('[Presence] Cleared stale online via GET /auth/me?client=agent');
        } catch (error) {
            console.warn('[Presence] Could not clear via /auth/me:', error.response?.status || error.message);
        }
    }

    async sendShiftOffline() {
        const user = authService.getUser();
        if (!user) return;

        const headers = { Authorization: `Bearer ${authService.getToken()}` };

        try {
            await axios.post(`${API_URL}/agent/shift-offline`, {
                org_id: user.org_id,
                user_id: user.id,
                device_identifier: authService.getDeviceId(),
            }, { headers });
            console.log('[ShiftOffline] User marked offline on server');
            return true;
        } catch (error) {
            const status = error.response?.status;
            const body = error.response?.data;
            if (status === 404) {
                console.warn(
                    '[ShiftOffline] POST /agent/shift-offline not found — will try GET /auth/me?client=agent after server deploy.'
                );
            } else {
                console.error('Failed to send shift-offline:', body || error.message);
            }
            return false;
        }
    }

    async sendHeartbeat() {
        const user = authService.getUser();
        if (!user) return;

        // Heartbeats only while on shift; end-shift clears currentWorkSessionId so managers see user offline.
        if (!monitorService.getCurrentWorkSessionId()) {
            return;
        }

        try {
            const payload = {
                org_id: user.org_id,
                user_id: user.id,
                device_identifier: authService.getDeviceId(),
                on_shift: true,
                status: 'ONLINE',
                state: monitorService.currentState,
                current_idle_time: monitorService.getCurrentIdleTime(),
                shift_cap_idle_seconds: monitorService.getShiftCapIdleSeconds(),
                shift_timer_paused: monitorService.isShiftTimerPaused(),
                shift_paused_seconds: monitorService.getShiftPausedSeconds(),
                last_seen_at: Date.now()
            };

            console.log(`[Heartbeat] Sending to ${API_URL}/agent/heartbeat`, payload);

            const response = await axios.post(`${API_URL}/agent/heartbeat`, payload, {
                headers: { Authorization: `Bearer ${authService.getToken()}` }
            });

            // Update Configuration if provided
            if (response.data && response.data.features) {
                const configService = require('./config');
                configService.update(response.data.features);
                try {
                    const { BrowserWindow } = require('electron');
                    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
                    if (win) win.webContents.send('agent-features-updated');
                } catch (_) { /* non-critical */ }

                this.applyIntervalFromConfig(response.data.features);
            }

            this.checkForForcedLogout(response);

            db.getDB().prepare(`
                INSERT INTO heartbeat_logs (org_id, user_id, device_id, last_seen_at, status)
                VALUES (?, ?, ?, ?, ?)
            `).run(user.org_id, user.id, authService.getDeviceId(), Date.now(), 'ONLINE');

        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error('Heartbeat failed.', `Status: ${error.response?.status || 'N/A'}`, `Error: ${errorMsg}`);
            this.checkForForcedLogout(error.response);
        }
    }

    checkForForcedLogout(response) {
        if (!response) return;

        const isForcedLogout =
            (response.status === 401 || response.status === 403) ||
            (response.data && response.data.command === 'FORCE_LOGOUT');

        if (isForcedLogout) {
            console.warn('AUTH FAILURE or SERVER COMMAND: FORCE_LOGOUT RECEIVED. Logging out agent...');
            const { app } = require('electron');
            if (app) {
                app.emit('force-logout');
            } else {
                // Fallback if app is not accessible here
                process.send && process.send({ type: 'force-logout' });
            }
        }
    }

    /** Immediate heartbeat so CRM shows online right after resume (not only on 5-min sync). */
    pushPresenceNow() {
        this.sendHeartbeat().catch((e) => {
            console.warn('[Presence] Immediate heartbeat failed:', e.response?.status || e.message);
        });
    }

    // Force an immediate sync (e.g. when user clicks Break/Resume)
    forceSync() {
        console.log('Force Sync triggered...');
        // We use setImmediate to not block the current caller if it's long-running
        setImmediate(() => this.sync());
    }

    /** Flush pending data then clear CRM online presence (after end shift). */
    async endShiftPresence() {
        try {
            await this.sync();
        } catch (e) {
            console.error('endShiftPresence sync failed:', e.message);
        }
        await this.sendShiftOffline();
    }
}

module.exports = new SyncService();
