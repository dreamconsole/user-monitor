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

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class SyncService {
    constructor() {
        this.interval = null;
        this.isSyncing = false;
    }

    start() {
        if (this.interval) return; // Already running

        console.log('Starting Sync Service...');
        try {
            this.interval = setInterval(() => {
                this.sync();
            }, SYNC_INTERVAL_MS);
            console.log('Sync Service interval set.');
        } catch (e) {
            console.error('CRITICAL ERROR in SyncService.start:', e);
        }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
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
                await axios.post(`${API_URL}/agent/activity-session`, {
                    id: row.id,
                    org_id: row.org_id,
                    user_id: row.user_id,
                    start_time: new Date(row.start_time).toISOString(),
                    end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
                    total_work_seconds: row.total_work_seconds,
                    total_idle_seconds: row.total_idle_seconds,
                    total_break_seconds: row.total_break_seconds,
                    status: 'active' // TODO: Detect finished status
                }, {
                    headers: { Authorization: `Bearer ${authService.getToken()}` }
                });

                // Update status (Stay pending if it's the current active session? 
                // No, we sync updates continuously. In a real app we might want a 'synced_at' timestamp)
                // For this POC, we can mark as synced, but monitor.js will update it back to pending if it changes.
                db.getDB().prepare(`
                    UPDATE work_sessions SET sync_status = 'synced' WHERE id = ?
                `).run(row.id);

                console.log(`Synced work session: ${row.id}`);
            } catch (error) {
                console.error(`Failed to sync work session ${row.id}`, error.message);
            }
        }
    }

    async syncActivityLogs() {
        const rows = db.getDB().prepare(`
            SELECT * FROM activity_logs WHERE sync_status = 'pending' LIMIT 50
        `).all();

        for (const row of rows) {
            try {
                await axios.post(`${API_URL}/agent/activity-log`, {
                    session_id: row.session_id,
                    org_id: row.org_id,
                    user_id: row.user_id,
                    log_time: new Date(row.log_time).toISOString(),
                    keyboard_events: row.keyboard_events,
                    mouse_events: row.mouse_events,
                    state: row.state,
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                }, {
                    headers: { Authorization: `Bearer ${authService.getToken()}` }
                });

                // Update status 
                db.getDB().prepare(`
                    UPDATE activity_logs SET sync_status = 'synced' WHERE id = ?
                `).run(row.id);

                console.log(`Synced activity log: ${row.id}`);
            } catch (error) {
                console.error(`Failed to sync activity log ${row.id}`, error.message);
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

                await axios.post(`${API_URL}/agent/break-log`, {
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

                // Update status 
                db.getDB().prepare(`
                    UPDATE break_logs SET sync_status = 'synced' WHERE id = ?
                `).run(row.id);

                console.log(`Synced break log: ${row.id}`);
            } catch (error) {
                console.error(`Failed to sync break log ${row.id}`, error.message);
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

                await axios.post(`${API_URL}/agent/screenshot`, form, {
                    headers: {
                        Authorization: `Bearer ${authService.getToken()}`,
                        ...form.getHeaders()
                    }
                });

                db.getDB().prepare(`
                    UPDATE screenshots SET sync_status = 'uploaded' WHERE id = ?
                `).run(row.id);

                fs.unlinkSync(row.file_path);
                console.log(`Synced screenshot: ${row.id}`);

            } catch (error) {
                console.error(`Failed to sync screenshot ${row.id}`, error.message);
            }
        }
    }

    async sendHeartbeat() {
        const user = authService.getUser();
        if (!user) return;

        try {
            const payload = {
                org_id: user.org_id,
                user_id: user.id,
                device_identifier: authService.getDeviceId(),
                status: 'ONLINE',
                last_seen_at: Date.now()
            };

            console.log(`[Heartbeat] Sending to ${API_URL}/agent/heartbeat`, payload);

            await axios.post(`${API_URL}/agent/heartbeat`, payload, {
                headers: { Authorization: `Bearer ${authService.getToken()}` }
            });

            db.getDB().prepare(`
                INSERT INTO heartbeat_logs (org_id, user_id, device_id, last_seen_at, status)
                VALUES (?, ?, ?, ?, ?)
            `).run(user.org_id, user.id, authService.getDeviceId(), Date.now(), 'ONLINE');

        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error('Heartbeat failed.', `Status: ${error.response?.status || 'N/A'}`, `Error: ${errorMsg}`);
        }
    }

    // Force an immediate sync (e.g. when user clicks Break/Resume)
    forceSync() {
        console.log('Force Sync triggered...');
        // We use setImmediate to not block the current caller if it's long-running
        setImmediate(() => this.sync());
    }
}

module.exports = new SyncService();
