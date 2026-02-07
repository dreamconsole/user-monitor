const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DUPLICATED LOGIC FROM src/db.js TO AVOID ELECTRON MOCKING ISSUES
console.log('--- STARTING STANDALONE DB VERIFICATION ---');

const mockUserDataPath = path.join(__dirname, 'mock_final_verify');
if (!fs.existsSync(mockUserDataPath)) {
    fs.mkdirSync(mockUserDataPath, { recursive: true });
}

function getAgentDataPath(orgId, userId) {
    const userDataPath = mockUserDataPath;
    const agentData = path.join(userDataPath, 'agent-data', `org_${orgId}`, `user_${userId}`);
    if (!fs.existsSync(agentData)) {
        fs.mkdirSync(agentData, { recursive: true });
    }
    return agentData;
}

try {
    const ORG_ID = 1;
    const USER_ID = 1;

    console.log('1. Initializing DB...');
    const dataPath = getAgentDataPath(ORG_ID, USER_ID);
    const dbPath = path.join(dataPath, 'db.sqlite');

    // Clean up old run
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const db = new Database(dbPath);
    console.log(`   DB File created at: ${dbPath}`);

    // Create Tables using the EXACT STRINGS from src/db.js

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

    db.exec(createWorkSessionsTable);
    db.exec(createActivityLogsTable);
    db.exec(createScreenshotsTable);
    db.exec(createHeartbeatTable);

    // 2. Check Tables
    console.log('2. Checking Tables...');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    console.log('   Found tables:', tableNames.join(', '));

    const expectedTables = ['work_sessions', 'activity_logs', 'screenshots', 'heartbeat_logs'];
    const missingTables = expectedTables.filter(t => !tableNames.includes(t));

    if (missingTables.length === 0) {
        console.log('   Active Tables Verification: ✅ PASSED');
    } else {
        console.error('   Active Tables Verification: ❌ FAILED. Missing:', missingTables);
    }

    // 3. Check Schemas (Specific Columns)
    console.log('3. Checking Schemas...');

    // Work Sessions
    const wsCols = db.prepare("PRAGMA table_info(work_sessions)").all().map(c => c.name);
    if (wsCols.includes('total_work_seconds') && wsCols.includes('total_idle_seconds')) {
        console.log('   Work Sessions Schema: ✅ PASSED (Found total_work/idle_seconds)');
    } else {
        console.error('   Work Sessions Schema: ❌ FAILED. Columns:', wsCols);
    }

    // Activity Logs
    const alCols = db.prepare("PRAGMA table_info(activity_logs)").all().map(c => c.name);
    if (alCols.includes('keyboard_events') && alCols.includes('state')) {
        console.log('   Activity Logs Schema: ✅ PASSED (Found granular columns)');
    } else {
        console.error('   Activity Logs Schema: ❌ FAILED. Columns:', alCols);
    }

    console.log('--- VERIFICATION COMPLETE ---');
    db.close();

} catch (error) {
    console.error('Verification Failed:', error);
} finally {
    try {
        fs.rmSync(mockUserDataPath, { recursive: true, force: true });
    } catch (e) { }
}
