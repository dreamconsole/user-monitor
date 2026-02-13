const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getAgentDataPath(orgId, userId) {
    const userDataPath = app.getPath('userData'); // Typically /agent-data or similar in dev
    // For this POC, we can store in a dedicated 'agent-data' inside userData
    const agentData = path.join(userDataPath, 'agent-data', `org_${orgId}`, `user_${userId}`);
    if (!fs.existsSync(agentData)) {
        fs.mkdirSync(agentData, { recursive: true });
    }
    return agentData;
}

function initDB(orgId, userId) {
    if (db) return db;

    const dataPath = getAgentDataPath(orgId, userId);
    const dbPath = path.join(dataPath, 'db.sqlite');

    console.log(`Initializing DB at: ${dbPath}`);

    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Create Tables
    const createWorkSessionsTable = `
        CREATE TABLE IF NOT EXISTS work_sessions (
            id TEXT PRIMARY KEY,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            total_work_seconds INTEGER DEFAULT 0,
            total_idle_seconds INTEGER DEFAULT 0,
            total_break_seconds INTEGER DEFAULT 0,
            sync_status TEXT DEFAULT 'pending'
        )
    `;

    const createActivityLogsTable = `
        CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            log_time INTEGER NOT NULL,
            keyboard_events INTEGER DEFAULT 0,
            mouse_events INTEGER DEFAULT 0,
            state TEXT,
            metadata TEXT,
            sync_status TEXT DEFAULT 'pending'
        )
    `;

    const createScreenshotsTable = `
        CREATE TABLE IF NOT EXISTS screenshots (
            id TEXT PRIMARY KEY,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            session_id TEXT,
            device_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            captured_at INTEGER NOT NULL,
            activity_type TEXT DEFAULT 'ACTIVE',
            sync_status TEXT DEFAULT 'pending'
        )
    `;

    const createHeartbeatTable = `
        CREATE TABLE IF NOT EXISTS heartbeat_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            last_seen_at INTEGER NOT NULL,
            status TEXT
        )
    `;

    const createBreakLogsTable = `
        CREATE TABLE IF NOT EXISTS break_logs (
            id TEXT PRIMARY KEY,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            break_type_id TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            duration_seconds INTEGER DEFAULT 0,
            sync_status TEXT DEFAULT 'pending'
        )
    `;

    const createAppUsageLogsTable = `
        CREATE TABLE IF NOT EXISTS app_usage_logs_local (
            id TEXT PRIMARY KEY,
            app_name TEXT,
            executable_name TEXT,
            window_title TEXT,
            start_time TEXT,
            end_time TEXT,
            duration_seconds INTEGER,
            synced INTEGER DEFAULT 0
        )
    `;

    db.exec(createWorkSessionsTable);
    db.exec(createActivityLogsTable);
    db.exec(createScreenshotsTable);
    db.exec(createHeartbeatTable);
    db.exec(createBreakLogsTable);
    db.exec(createAppUsageLogsTable);

    // Migration: Add total_break_seconds to work_sessions if missing
    const columns = db.prepare("PRAGMA table_info(work_sessions)").all();
    const hasTotalBreakSeconds = columns.some(col => col.name === 'total_break_seconds');
    if (!hasTotalBreakSeconds) {
        console.log('Migrating: Adding total_break_seconds to work_sessions');
        db.exec('ALTER TABLE work_sessions ADD COLUMN total_break_seconds INTEGER DEFAULT 0');
    }

    // Migration: Add session_id to screenshots if missing
    const screenshotColumns = db.prepare("PRAGMA table_info(screenshots)").all();
    const hasSessionId = screenshotColumns.some(col => col.name === 'session_id');
    if (!hasSessionId) {
        console.log('Migrating: Adding session_id to screenshots');
        db.exec('ALTER TABLE screenshots ADD COLUMN session_id TEXT');
    }

    return db;
}

function isInitialized() {
    return db !== null;
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call initDB first.');
    }
    return db;
}

function closeDB() {
    if (db) {
        db.close();
        db = null;
    }
}

// App usage log helpers
function insertAppUsageLog(log) {
    const stmt = db.prepare(`
        INSERT INTO app_usage_logs_local (id, app_name, executable_name, window_title, start_time, end_time, duration_seconds, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(log.id, log.app_name, log.executable_name, log.window_title, log.start_time, log.end_time, log.duration_seconds, log.synced);
}

function getUnsyncedAppUsageLogs() {
    const stmt = db.prepare('SELECT * FROM app_usage_logs_local WHERE synced = 0 ORDER BY start_time LIMIT 100');
    return stmt.all();
}

function markAppUsageLogsSynced(ids) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE app_usage_logs_local SET synced = 1 WHERE id IN (${placeholders})`);
    stmt.run(...ids);
}

module.exports = {
    initDB,
    getDB,
    isInitialized,
    closeDB,
    getAgentDataPath,
    insertAppUsageLog,
    getUnsyncedAppUsageLogs,
    markAppUsageLogsSynced
};
