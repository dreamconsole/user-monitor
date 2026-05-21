const { powerMonitor } = require('electron');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authService = require('./auth');
const screenshotService = require('./screenshot');
const configService = require('./config');
const { uIOhook } = require('uiohook-napi');

const POLL_INTERVAL_MS = 60 * 1000; // Check every 1 minute (for granular logging)

class MonitorService {
    constructor() {
        this.interval = null;
        this.currentWorkSessionId = null;
        this.orgId = null;
        this.userId = null;
        this.deviceId = null;
        this.campaignId = null;
        this.isPaused = false;
        this.currentState = 'OFFLINE';
        this.breakType = null;

        // Session Accumulators
        this.sessionStartTime = 0;
        this.totalWorkSeconds = 0;
        this.totalIdleSeconds = 0;
        this.totalBreakSeconds = 0;

        this.keyboardEvents = 0;
        this.mouseEvents = 0;
        this.leftClickEvents = 0;
        this.rightClickEvents = 0;
        this.lastCheckTime = 0;

        // Dynamic Config Values
        this._applyPolicyConfig();

        // Listen for config changes
        configService.on('config-updated', (config) => {
            console.log('[MonitorService] Config updated, applying new settings...');
            this._applyPolicyConfig(config);
        });

        this.shiftClockPaused = false;
        this.shiftPausedAt = 0;
        this.idleSinceAt = 0;

        // Start uIOhook
        uIOhook.on('keydown', () => { this.keyboardEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('keyup', () => { this.keyboardEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('mousedown', (e) => {
            this.mouseEvents++;
            if (e.button === 1) this.leftClickEvents++;      // Left click (touchpad tap OR mouse left)
            else if (e.button === 2) this.rightClickEvents++; // Right click (touchpad right-tap OR mouse right)
            this.lastInputTime = Date.now();
        });
        uIOhook.on('mouseup', () => { this.mouseEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('mousemove', () => { this.mouseEvents++; this.lastInputTime = Date.now(); });
        uIOhook.start();
        this.lastInputTime = Date.now();
    }

    getCurrentWorkSessionId() {
        return this.currentWorkSessionId;
    }

    getCurrentIdleTime() {
        if (this.isPaused || !this.currentWorkSessionId) return 0;
        const systemIdleTime = powerMonitor.getSystemIdleTime();
        const inputIdleTime = Math.floor((Date.now() - this.lastInputTime) / 1000);
        return Math.min(systemIdleTime, inputIdleTime);
    }

    /** Raw system/input idle (seconds) for max-shift policy; non-zero on break so server can force logout after cap + idle. */
    getShiftCapIdleSeconds() {
        const systemIdleTime = powerMonitor.getSystemIdleTime();
        const inputIdleTime = Math.floor((Date.now() - this.lastInputTime) / 1000);
        return Math.min(systemIdleTime, inputIdleTime);
    }

    _applyPolicyConfig(config) {
        const c = config || configService.getAll();
        this.afkThresholdSeconds = c.afk_threshold_seconds || 300;
        this.isAfkTrackingEnabled = c.is_afk_tracking_enabled !== false;
        this.isBreaksEnabled = c.is_breaks_enabled !== false;
        this.shiftGraceMinutes = parseInt(c.shift_grace_minutes, 10) || 5;
        this.shiftAbsenceMinutes = parseInt(c.shift_absence_minutes, 10) || 120;
        this.shiftAbsenceAction = c.shift_absence_action || 'logout';
    }

    getShiftPausedSeconds() {
        if (!this.shiftClockPaused || !this.shiftPausedAt) return 0;
        return Math.floor((Date.now() - this.shiftPausedAt) / 1000);
    }

    isShiftTimerPaused() {
        return this.shiftClockPaused === true;
    }

    _getIdleSeconds() {
        const systemIdleTime = powerMonitor.getSystemIdleTime();
        const inputIdleTime = Math.floor((Date.now() - this.lastInputTime) / 1000);
        return Math.min(systemIdleTime, inputIdleTime);
    }

    _pauseShiftClock() {
        if (this.shiftClockPaused) return;
        this.shiftClockPaused = true;
        this.shiftPausedAt = Date.now();
        console.log('[MonitorService] Shift clock paused (grace expired, still idle)');
        this.currentState = 'SHIFT_PAUSED';
        if (global.statusUpdateCallback) global.statusUpdateCallback('SHIFT_PAUSED');
        screenshotService.setCurrentState('AFK');
    }

    _resumeShiftClock() {
        if (!this.shiftClockPaused) return;
        this.shiftClockPaused = false;
        this.shiftPausedAt = 0;
        this.idleSinceAt = 0;
        console.log('[MonitorService] Shift clock resumed (user active)');
        this.currentState = 'ACTIVE';
        if (global.statusUpdateCallback) global.statusUpdateCallback('ACTIVE');
        screenshotService.setCurrentState('ACTIVE');
    }

    _evaluateNoBreaksPolicy(idleTime) {
        if (this.isBreaksEnabled || !this.isAfkTrackingEnabled || !this.currentWorkSessionId) return;

        const graceSec = this.shiftGraceMinutes * 60;
        const absenceSec = this.shiftAbsenceMinutes * 60;
        const isIdle = idleTime >= this.afkThresholdSeconds;

        if (!isIdle) {
            if (this.shiftClockPaused) this._resumeShiftClock();
            this.idleSinceAt = 0;
            return;
        }

        if (!this.idleSinceAt) this.idleSinceAt = Date.now();

        const idleDurationSec = Math.floor((Date.now() - this.idleSinceAt) / 1000);

        if (!this.shiftClockPaused && idleDurationSec >= graceSec) {
            this._pauseShiftClock();
        }

        if (this.shiftClockPaused) {
            const pausedSec = this.getShiftPausedSeconds();
            if (pausedSec >= absenceSec) {
                console.log(`[MonitorService] Shift absence limit (${this.shiftAbsenceMinutes}m) reached`);
                if (global.forceEndShiftCallback) global.forceEndShiftCallback(this.shiftAbsenceAction);
            }
        }
    }

    start(campaignId = null) {
        console.log('Starting Monitor Service...');
        try {
            const user = authService.getUser();
            if (!user) {
                console.error('Cannot start monitor: No user logged in');
                return;
            }
            if (!db.isInitialized()) {
                console.error('Cannot start monitor: Database not initialized. Try logging in again.');
                return;
            }

            this.orgId = user.org_id;
            this.userId = user.id;
            this.deviceId = authService.getDeviceId();
            this.campaignId = campaignId || null;
            this.isPaused = false;
            this.breakType = null;
            this.shiftClockPaused = false;
            this.shiftPausedAt = 0;
            this.idleSinceAt = 0;
            this.lastCheckTime = Date.now();
            this.lastInputTime = Date.now();

            this._applyPolicyConfig();

            // Session Recovery: Close old sessions/breaks in local DB
            try {
                const closeTime = Date.now();
                db.getDB().prepare(`UPDATE work_sessions SET end_time = ?, sync_status = 'pending' WHERE end_time IS NULL`).run(closeTime);
                db.getDB().prepare(`UPDATE break_logs SET end_time = ?, sync_status = 'pending' WHERE end_time IS NULL`).run(closeTime);
                console.log('[MonitorService] Local session recovery complete. Closed old pending sessions/breaks.');
            } catch (e) {
                console.error('[MonitorService] Session recovery error:', e);
            }

            // Start a new Work Session (Shift)
            console.log('Calling startWorkSession...');
            this.startWorkSession();

            this.currentState = 'ACTIVE';
            if (global.statusUpdateCallback) global.statusUpdateCallback('ACTIVE');

            if (this.interval) clearInterval(this.interval);

            // Wait one interval BEFORE first log to avoid "0 second" or "immediate 60s" bug
            this.interval = setInterval(() => {
                this.checkAndLogActivity();
            }, POLL_INTERVAL_MS);

            // Also start screenshot service loop
            console.log('Starting screenshot service...');
            screenshotService.start(this.orgId, this.userId, this.deviceId, this.currentWorkSessionId);

            // Start app tracking
            console.log('Starting app tracker...');
            const appTracker = require('./appTracker');
            appTracker.start();

            console.log('Monitor Service Started successfully.');
        } catch (error) {
            console.error('CRITICAL ERROR in MonitorService.start:', error);
        }
    }

    startWorkSession() {
        console.log('Inside startWorkSession...');
        try {
            this.currentWorkSessionId = uuidv4();
            this.sessionStartTime = Date.now();
            this.totalWorkSeconds = 0;
            this.totalIdleSeconds = 0;
            this.totalBreakSeconds = 0;

            console.log('Preparing INSERT work_sessions statement...');
            const stmt = db.getDB().prepare(`
                INSERT INTO work_sessions (id, org_id, user_id, device_id, start_time, campaign_id, sync_status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `);

            console.log('Running INSERT work_sessions statement...');
            stmt.run(
                this.currentWorkSessionId,
                this.orgId,
                this.userId,
                this.deviceId,
                this.sessionStartTime,
                this.campaignId
            );
            console.log(`Started Work Session: ${this.currentWorkSessionId} (Campaign: ${this.campaignId || 'None'})`);

            // Immediate sync to server
            require('./sync').forceSync();
        } catch (error) {
            console.error('CRITICAL ERROR in startWorkSession:', error);
        }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);

        // Final update before stopping
        if (this.currentWorkSessionId) {
            // Check if we were idle since last check
            this.updateWorkSessionInDB();
            this.currentWorkSessionId = null;
            // Immediate sync to server
            require('./sync').forceSync();
        }

        this.shiftClockPaused = false;
        this.shiftPausedAt = 0;
        this.idleSinceAt = 0;
        this.currentState = 'OFFLINE';
        if (global.statusUpdateCallback) global.statusUpdateCallback('OFFLINE');

        screenshotService.stop();

        // Stop app tracking
        const appTracker = require('./appTracker');
        appTracker.stop();

        console.log('Monitor Service stopped.');
    }

    /**
     * Start a break. Only one open break at a time; closes orphaned local open breaks (e.g. after crash) before starting.
     * @returns {{ ok: true } | { ok: false, reason: string }}
     */
    pause(breakType) {
        if (!this.currentWorkSessionId) {
            console.warn('MonitorService.pause: No active work session; start shift first.');
            return { ok: false, reason: 'no_session' };
        }
        if (this.isPaused) {
            console.warn('MonitorService.pause: Already on break; end break with Resume first.');
            return { ok: false, reason: 'already_on_break' };
        }

        console.log(`Monitor Service: Pausing for ${breakType}`);

        if (db.isInitialized()) {
            try {
                const orphans = db.getDB().prepare(
                    `SELECT id, start_time FROM break_logs
                     WHERE org_id = ? AND user_id = ? AND end_time IS NULL`
                ).all(this.orgId, this.userId);
                const nowClose = Date.now();
                for (const row of orphans) {
                    const duration = Math.max(0, Math.floor((nowClose - row.start_time) / 1000));
                    db.getDB().prepare(
                        `UPDATE break_logs SET end_time = ?, duration_seconds = ?, sync_status = 'pending' WHERE id = ?`
                    ).run(nowClose, duration, row.id);
                    console.warn(`[MonitorService] Closed orphaned open break ${row.id} (${duration}s) before starting a new break.`);
                }
            } catch (e) {
                console.error('Failed to close orphaned breaks:', e);
            }
        }

        this.currentBreakId = uuidv4();
        this.isPaused = true;
        this.breakType = breakType;
        this.breakStartTime = Date.now();
        this.currentState = 'BREAK';
        if (global.statusUpdateCallback) global.statusUpdateCallback('BREAK');

        if (db.isInitialized()) {
            try {
                const stmt = db.getDB().prepare(`
                    INSERT INTO break_logs (id, org_id, user_id, session_id, break_type_id, start_time, sync_status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')
                `);
                stmt.run(
                    this.currentBreakId,
                    this.orgId,
                    this.userId,
                    this.currentWorkSessionId,
                    breakType, // Storing the string/ID passed from UI
                    this.breakStartTime
                );
                console.log(`Started Break: ${this.currentBreakId} (${breakType})`);

                // Immediate sync to server
                require('./sync').forceSync();
            } catch (e) {
                console.error('Failed to log break start:', e);
                this.isPaused = false;
                this.currentBreakId = null;
                this.breakType = null;
                this.currentState = 'ACTIVE';
                if (global.statusUpdateCallback) global.statusUpdateCallback('ACTIVE');
                return { ok: false, reason: 'db_error' };
            }
        } else {
            console.warn('DB not initialized; break start not persisted. Start tracking first.');
            this.isPaused = false;
            this.currentBreakId = null;
            this.breakType = null;
            this.currentState = 'ACTIVE';
            if (global.statusUpdateCallback) global.statusUpdateCallback('ACTIVE');
            return { ok: false, reason: 'db_not_initialized' };
        }

        screenshotService.setCurrentState('BREAK');
        return { ok: true };
    }

    resume() {
        console.log('Monitor Service: Resuming');
        if (this.isPaused && this.currentBreakId && db.isInitialized()) {
            const endTime = Date.now();
            const duration = Math.floor((endTime - this.breakStartTime) / 1000);

            try {
                const stmt = db.getDB().prepare(`
                    UPDATE break_logs 
                    SET end_time = ?, duration_seconds = ?, sync_status = 'pending'
                    WHERE id = ?
                `);
                stmt.run(endTime, duration, this.currentBreakId);
                console.log(`Ended Break: ${this.currentBreakId}, Duration: ${duration}s`);

                this.totalBreakSeconds += duration;

                // Reset check time so we don't count break as work
                this.lastCheckTime = Date.now();
                this.updateWorkSessionInDB();

                // Immediate sync to server
                require('./sync').forceSync();
            } catch (e) {
                console.error('Failed to log break end:', e);
            }
        } else if (this.isPaused && !db.isInitialized()) {
            console.warn('DB not initialized; break end not persisted.');
        }

        this.isPaused = false;
        this.breakType = null;
        this.currentBreakId = null;
        this.currentState = 'ACTIVE';
        if (global.statusUpdateCallback) global.statusUpdateCallback('ACTIVE');
        screenshotService.setCurrentState('ACTIVE');
    }

    checkAndLogActivity() {
        if (this.isPaused || !this.currentWorkSessionId) return;

        const idleTime = this._getIdleSeconds();

        const now = Date.now();
        const secondsElapsed = Math.floor((now - this.lastCheckTime) / 1000);
        this.lastCheckTime = now;

        console.log(`[checkAndLogActivity] Idle: ${idleTime}s, Elapsed: ${secondsElapsed}s, Threshold: ${this.afkThresholdSeconds}s, ShiftPaused: ${this.shiftClockPaused}`);

        this._evaluateNoBreaksPolicy(idleTime);

        let state = 'active';
        const wasActive = this.currentState === 'ACTIVE' || this.currentState === 'SHIFT_PAUSED';

        // Check if AFK tracking is enabled
        if (this.isAfkTrackingEnabled) {
            if (idleTime >= this.afkThresholdSeconds) {
                state = 'idle';
                this.totalIdleSeconds += secondsElapsed;

                // LOGIC FIX: If we JUST crossed the threshold
                if (wasActive) {
                    console.log('Transition to IDLE detected. Adjusting work/idle balance.');
                    // Move the threshold time from work to idle
                    const adjustment = Math.min(this.totalWorkSeconds, this.afkThresholdSeconds);
                    this.totalWorkSeconds -= adjustment;
                    this.totalIdleSeconds += adjustment;
                }
            } else {
                state = 'active';
                this.totalWorkSeconds += secondsElapsed;
            }
        } else {
            // If AFK tracking is disabled, always active
            state = 'active';
            this.totalWorkSeconds += secondsElapsed;
        }

        // 1. Log Granular Activity (The "Full Track")
        this.logActivityChunk(state);

        // 2. Update Work Session Totals
        this.updateWorkSessionInDB();

        // Let screenshot service know current state (preserve SHIFT_PAUSED for UI timer)
        if (!this.shiftClockPaused) {
            const newState = state === 'idle' ? 'AFK' : 'ACTIVE';
            if (this.currentState !== 'SHIFT_PAUSED' && this.currentState !== newState) {
                this.currentState = newState;
                if (global.statusUpdateCallback) global.statusUpdateCallback(newState);
            }
            screenshotService.setCurrentState(newState);
        }
    }

    logActivityChunk(state) {
        const logId = uuidv4();
        const stmt = db.getDB().prepare(`
            INSERT INTO activity_logs (
                id, session_id, org_id, user_id, log_time, 
                keyboard_events, mouse_events, left_clicks, right_clicks, state, sync_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `);

        // Use captured events and reset
        const kEvents = this.keyboardEvents;
        const mEvents = this.mouseEvents;
        const lClicks = this.leftClickEvents;
        const rClicks = this.rightClickEvents;
        this.keyboardEvents = 0;
        this.mouseEvents = 0;
        this.leftClickEvents = 0;
        this.rightClickEvents = 0;

        stmt.run(
            logId,
            this.currentWorkSessionId,
            this.orgId,
            this.userId,
            Date.now(),
            kEvents,
            mEvents,
            lClicks,
            rClicks,
            state
        );
    }

    updateWorkSessionInDB() {
        const stmt = db.getDB().prepare(`
            UPDATE work_sessions
            SET end_time = ?, total_work_seconds = ?, total_idle_seconds = ?, total_break_seconds = ?, sync_status = 'pending'
            WHERE id = ?
        `);

        stmt.run(
            Date.now(),
            this.totalWorkSeconds,
            this.totalIdleSeconds,
            this.totalBreakSeconds,
            this.currentWorkSessionId
        );
    }
}

module.exports = new MonitorService();
