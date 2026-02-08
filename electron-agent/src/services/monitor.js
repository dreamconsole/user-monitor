const { powerMonitor } = require('electron');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authService = require('./auth');
const screenshotService = require('./screenshot');
const { uIOhook } = require('uiohook-napi');

const IDLE_THRESHOLD_SECONDS = 300; // 5 minutes
const POLL_INTERVAL_MS = 60 * 1000; // Check every 1 minute (for granular logging)

class MonitorService {
    constructor() {
        this.interval = null;
        this.currentWorkSessionId = null;
        this.orgId = null;
        this.userId = null;
        this.deviceId = null;
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
        this.lastCheckTime = 0;

        // Start uIOhook
        uIOhook.on('keydown', () => { this.keyboardEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('keyup', () => { this.keyboardEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('mousedown', () => { this.mouseEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('mouseup', () => { this.mouseEvents++; this.lastInputTime = Date.now(); });
        uIOhook.on('mousemove', () => { this.mouseEvents++; this.lastInputTime = Date.now(); });
        uIOhook.start();
        this.lastInputTime = Date.now();
    }

    getCurrentWorkSessionId() {
        return this.currentWorkSessionId;
    }

    start() {
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
            this.isPaused = false;
            this.breakType = null;
            this.lastCheckTime = Date.now();
            this.lastInputTime = Date.now();

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
                INSERT INTO work_sessions (id, org_id, user_id, device_id, start_time, sync_status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            `);

            console.log('Running INSERT work_sessions statement...');
            stmt.run(
                this.currentWorkSessionId,
                this.orgId,
                this.userId,
                this.deviceId,
                this.sessionStartTime
            );
            console.log(`Started Work Session: ${this.currentWorkSessionId}`);

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

        this.currentState = 'OFFLINE';
        if (global.statusUpdateCallback) global.statusUpdateCallback('OFFLINE');

        screenshotService.stop();
        console.log('Monitor Service stopped.');
    }

    pause(breakType) {
        console.log(`Monitor Service: Pausing for ${breakType}`);
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
            }
        } else {
            console.warn('DB not initialized; break start not persisted. Start tracking first.');
        }

        screenshotService.setCurrentState('BREAK');
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

        const systemIdleTime = powerMonitor.getSystemIdleTime();
        // Fallback: Check time since last uIOhook event
        const inputIdleTime = Math.floor((Date.now() - this.lastInputTime) / 1000);
        // Use the minimum of both to be generous to the user
        const idleTime = Math.min(systemIdleTime, inputIdleTime);

        const now = Date.now();
        const secondsElapsed = Math.floor((now - this.lastCheckTime) / 1000);
        this.lastCheckTime = now;

        console.log(`[checkAndLogActivity] Idle: ${idleTime}s (Sys: ${systemIdleTime}s, Input: ${inputIdleTime}s), Elapsed: ${secondsElapsed}s`);

        let state = 'active';
        const wasActive = this.currentState === 'ACTIVE';

        if (idleTime >= IDLE_THRESHOLD_SECONDS) {
            state = 'idle';
            this.totalIdleSeconds += secondsElapsed;

            // LOGIC FIX: If we JUST crossed the threshold (e.g. idleTime is 300-360)
            // The previous polls might have wrongly added time to totalWorkSeconds
            // We should retrospective move that time to idle if this is the first 'idle' poll
            if (wasActive) {
                console.log('Transition to IDLE detected. Adjusting work/idle balance.');
                // Move the threshold time from work to idle
                const adjustment = Math.min(this.totalWorkSeconds, IDLE_THRESHOLD_SECONDS);
                this.totalWorkSeconds -= adjustment;
                this.totalIdleSeconds += adjustment;
            }
        } else {
            state = 'active';
            this.totalWorkSeconds += secondsElapsed;
        }

        // 1. Log Granular Activity (The "Full Track")
        this.logActivityChunk(state);

        // 2. Update Work Session Totals
        this.updateWorkSessionInDB();

        // Let screenshot service know current state
        const newState = state === 'idle' ? 'AFK' : 'ACTIVE';
        if (this.currentState !== newState) {
            this.currentState = newState;
            if (global.statusUpdateCallback) global.statusUpdateCallback(newState);
        }
        screenshotService.setCurrentState(newState);
    }

    logActivityChunk(state) {
        const logId = uuidv4();
        const stmt = db.getDB().prepare(`
            INSERT INTO activity_logs (
                id, session_id, org_id, user_id, log_time, 
                keyboard_events, mouse_events, state, sync_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `);

        // Use captured events and reset
        const kEvents = this.keyboardEvents;
        const mEvents = this.mouseEvents;
        this.keyboardEvents = 0;
        this.mouseEvents = 0;

        stmt.run(
            logId,
            this.currentWorkSessionId,
            this.orgId,
            this.userId,
            Date.now(),
            kEvents,
            mEvents,
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
