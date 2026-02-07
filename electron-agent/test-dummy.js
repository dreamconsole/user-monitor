const { v4: uuidv4 } = require('uuid');
const db = require('./src/db');
const authService = require('./src/services/auth');
const syncService = require('./src/services/sync');

async function testDummy() {
    console.log('--- DUMMY SYNC TEST ---');

    // 1. Mock Auth (Assume we are logged in)
    const user = {
        id: '1416ea83-c37d-449d-b6bc-30ae199ef675', // UUID
        org_id: '8e8b9f75-a414-4213-b09f-34be0c1065f7', // UUID
        email: 'user@acme.com'
    };
    authService.user = user;
    authService.token = 'mock-token'; // We might need a real token if we want to hit the server
    // Note: authService.token is set from store usually. 
    // We can just rely on the existing store if it was logged in.

    // 2. Init DB
    db.initDB(user.org_id, user.id);

    const sessionId = uuidv4();
    const startTime = Date.now();

    console.log(`Inserting Dummy Session: ${sessionId}`);

    // 3. Insert Dummy Session
    db.getDB().prepare(`
        INSERT INTO work_sessions (id, org_id, user_id, device_id, start_time, sync_status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(sessionId, user.org_id, user.id, 'dummy-device', startTime);

    // 4. Insert Dummy Logs
    console.log('Inserting Dummy Activity Logs...');
    const log1 = uuidv4();
    const log2 = uuidv4();

    const activityInsert = db.getDB().prepare(`
        INSERT INTO activity_logs (
            id, session_id, org_id, user_id, log_time, 
            keyboard_events, mouse_events, state, sync_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    // Log 1: Time = Now, Events = 999 (Distinctive)
    activityInsert.run(log1, sessionId, user.org_id, user.id, Date.now(), 999, 888, 'active');

    // Log 2: Time = Now - 1min, Events = 111
    activityInsert.run(log2, sessionId, user.org_id, user.id, Date.now() - 60000, 111, 222, 'idle');

    console.log('Starting Sync...');
    // 5. Trigger Sync
    try {
        await syncService.sync();
        console.log('Sync completed (or attempted).');
    } catch (e) {
        console.error('Sync execution failed:', e);
    }

    console.log('Check Postgres activity_logs for keyboard_events = 999');
    process.exit();
}

testDummy();
