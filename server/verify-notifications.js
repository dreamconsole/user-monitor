import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { query } from './src/db.js';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_URL = 'http://localhost:3000';

async function verify() {
    console.log('--- VERIFY NOTIFICATIONS E2E ---');

    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@acme.com', password: 'password123' })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error('Login failed: ' + JSON.stringify(loginData));
        const token = loginData.token;
        const user = loginData.user;
        const userName = user.name || user.full_name;
        console.log(`Logged in as ${userName} (${user.id})`);

        // 2. Create a Work Session (Required for FK)
        const sessionId = crypto.randomUUID();
        console.log(`Creating Work Session: ${sessionId}...`);
        const sessionRes = await fetch(`${API_URL}/agent/activity-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id: sessionId,
                org_id: user.org_id,
                user_id: user.id,
                start_time: new Date().toISOString(),
                status: 'active'
            })
        });
        if (!sessionRes.ok) throw new Error('Failed to create session: ' + await sessionRes.text());
        console.log('Session created.');

        // 3. Get a Break Type
        console.log('Fetching breaks...');
        const breaksRes = await fetch(`${API_URL}/agent/breaks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const breaks = (await breaksRes.json()).breaks;
        const bType = breaks.find(b => b.max_duration_seconds > 0);
        if (!bType) throw new Error('No break type with limit found');
        console.log(`Using Break Type: ${bType.name} (Limit: ${bType.max_duration_seconds}s)`);

        // 4. Trigger Violation
        const duration = bType.max_duration_seconds + 3600; // Limit + 1 hour
        const startTime = new Date(Date.now() - duration * 1000).toISOString();
        const endTime = new Date().toISOString();

        console.log(`Simulating Break Violation (Duration: ${duration}s)...`);
        const logRes = await fetch(`${API_URL}/agent/break-log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id: crypto.randomUUID(),
                org_id: user.org_id,
                user_id: user.id,
                session_id: sessionId,
                break_type_id: bType.id,
                start_time: startTime,
                end_time: endTime,
                duration_seconds: duration
            })
        });

        if (!logRes.ok) {
            console.error('Failed to log break:', await logRes.text());
        } else {
            console.log('Break logged successfully.');
        }

        // 5. Verify Notification in DB
        console.log('Waiting for notification processing...');
        await new Promise(r => setTimeout(r, 1000));

        const notifRes = await query(`
            SELECT * FROM notifications 
            WHERE actor_id = $1 
            ORDER BY created_at DESC LIMIT 1
        `, [user.id]);

        if (notifRes.rows.length > 0) {
            const notif = notifRes.rows[0];
            // Check if it's recent (within last minute)
            const isRecent = (Date.now() - new Date(notif.created_at).getTime()) < 60000;
            if (isRecent) {
                console.log('SUCCESS: New Notification Found!');
                console.log(notif);
            } else {
                console.warn('WARNING: Found outdated notification:', notif);
            }
        } else {
            console.error('FAILURE: No notification found for user.');
        }

    } catch (e) {
        console.error('Verification Error:', e);
    }
}

verify();
