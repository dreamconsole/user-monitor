import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3000';

async function testAPI() {
    console.log('--- API DUMMY TEST (Pure Node) ---');

    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'user@acme.com',
                password: 'password123'
            })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);

        const token = loginData.token;
        const user = loginData.user;
        const orgId = user.org_id;
        const userId = user.id;

        console.log(`Logged in as: ${user.email} (Org: ${orgId})`);

        const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; // Hardcoded UUID

        // A. Test Activity Session
        console.log('Testing /agent/activity-session...');
        const sessionRes = await fetch(`${API_URL}/agent/activity-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id: sessionId,
                org_id: orgId,
                user_id: userId,
                start_time: new Date().toISOString(),
                total_work_seconds: 1234, // Distinctive!
                total_idle_seconds: 567,   // Distinctive!
                status: 'active'
            })
        });
        console.log('Session response:', sessionRes.status);

        // C. Test Break Logs
        console.log('Testing /agent/break-log with different break types...');
        const breaksToTest = ['Lunch Break', 'Tea', 'Personal', 'InvalidBreak'];
        for (const bt of breaksToTest) {
            console.log(`Sending break log for: ${bt}`);
            const breakRes = await fetch(`${API_URL}/agent/break-log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: crypto.randomUUID(),
                    org_id: orgId,
                    user_id: userId,
                    session_id: sessionId,
                    break_type_id: bt, // Server should resolve name
                    start_time: new Date().toISOString(),
                    duration_seconds: 600
                })
            });
            console.log(`Break (${bt}) response:`, breakRes.status);
            if (!breakRes.ok) {
                const errorData = await breakRes.json();
                console.log(`Error details for ${bt}:`, errorData);
            }
        }

        // B. Test Activity Log
        console.log('Testing /agent/activity-log...');
        const logTime = new Date().toISOString();
        const activityRes = await fetch(`${API_URL}/agent/activity-log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                session_id: sessionId,
                org_id: orgId,
                user_id: userId,
                log_time: logTime,
                keyboard_events: 9999, // Distinctive!
                mouse_events: 8888,     // Distinctive!
                state: 'active'
            })
        });
        console.log('Activity log response:', activityRes.status);

        console.log('\n--- VERIFYING RESULTS IN DB ---');
        // I will use a separate shell command to check the DB to avoid complexity in this fetch-based script.

        console.log('SUCCESS: All test requests sent.');

    } catch (e) {
        console.error('API Test Failed:', e.message);
    }
}

testAPI();
