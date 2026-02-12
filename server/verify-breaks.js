import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

dotenv.config();

const API_URL = 'http://localhost:3000';

async function verifyBreaksAndScreenshots() {
    console.log('--- VERIFY BREAKS & SCREENSHOTS ---');

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
        console.log('Login successful.');

        // 2. Fetch Breaks
        console.log('Fetching breaks...');
        const breaksRes = await fetch(`${API_URL}/agent/breaks`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const breaksData = await breaksRes.json();
        if (breaksRes.ok) {
            console.log('Breaks found:', JSON.stringify(breaksData.breaks, null, 2));
        } else {
            console.error('FAILED to fetch breaks:', breaksData);
        }

        // 3. Verify Screenshots (FileSystem Check)
        console.log('\n--- VERIFYING SCREENSHOTS (Server Filesystem) ---');
        const uploadDir = path.join(process.cwd(), 'uploads/screenshots');

        if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir);
            console.log(`Total files in ${uploadDir}: ${files.length}`);
            if (files.length > 0) {
                const latest = files.map(f => ({ name: f, time: fs.statSync(path.join(uploadDir, f)).mtime.getTime() }))
                    .sort((a, b) => b.time - a.time)
                    .slice(0, 3);
                console.log('Latest 3 screenshots:', latest);
            } else {
                console.warn('WARNING: No screenshots found in uploads directory.');
            }
        } else {
            console.warn(`WARNING: Upload directory does not exist: ${uploadDir}`);
        }

        console.log('--- DONE ---');

    } catch (e) {
        console.error('Verification Failed:', e.message);
    }
}

verifyBreaksAndScreenshots();
