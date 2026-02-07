const db = require('./src/db');
const path = require('path');
const fs = require('fs');
const Module = require('module');

// Mock electron
const mockUserDataPath = path.join(__dirname, 'mock_verify_data');
if (!fs.existsSync(mockUserDataPath)) {
    fs.mkdirSync(mockUserDataPath, { recursive: true });
}

// Intercept require calls to mock 'electron'
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
    if (request === 'electron') {
        return {
            app: {
                getPath: (name) => {
                    if (name === 'userData') return mockUserDataPath;
                    return '/tmp';
                }
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

// Now verify
console.log('--- STARTING DB VERIFICATION ---');

try {
    // Re-requiring db to use the interceptor
    const dbModule = require('./src/db');

    const ORG_ID = 999;
    const USER_ID = 999;

    // 1. Initialize DB
    console.log('1. Initializing DB...');
    dbModule.initDB(ORG_ID, USER_ID);

    const database = dbModule.getDB();

    // 2. Check Tables
    console.log('2. Checking Tables...');
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
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
    const wsCols = database.prepare("PRAGMA table_info(work_sessions)").all().map(c => c.name);
    if (wsCols.includes('total_work_seconds') && wsCols.includes('total_idle_seconds')) {
        console.log('   Work Sessions Schema: ✅ PASSED (Found total_work/idle_seconds)');
    } else {
        console.error('   Work Sessions Schema: ❌ FAILED. Columns:', wsCols);
    }

    // Activity Logs
    const alCols = database.prepare("PRAGMA table_info(activity_logs)").all().map(c => c.name);
    if (alCols.includes('keyboard_events') && alCols.includes('state')) {
        console.log('   Activity Logs Schema: ✅ PASSED (Found granular columns)');
    } else {
        console.error('   Activity Logs Schema: ❌ FAILED. Columns:', alCols);
    }

    console.log('--- VERIFICATION COMPLETE ---');
    dbModule.closeDB();

} catch (error) {
    console.error('Verification Failed:', error);
} finally {
    try {
        fs.rmSync(mockUserDataPath, { recursive: true, force: true });
    } catch (e) { }
}
