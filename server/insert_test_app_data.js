import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function insertTestData() {
    const client = await pool.connect();
    try {
        console.log('=== Inserting Test App Usage Data ===\n');

        // Get first user and org
        const userResult = await client.query('SELECT id, org_id FROM users LIMIT 1');
        if (userResult.rows.length === 0) {
            console.error('No users found in database!');
            return;
        }

        const { id: userId, org_id: orgId } = userResult.rows[0];
        console.log(`Using User ID: ${userId}, Org ID: ${orgId}`);

        // Get or create active work session
        let sessionResult = await client.query(`
            SELECT id FROM work_sessions 
            WHERE user_id = $1 AND org_id = $2 AND status = 'active'
            ORDER BY start_time DESC LIMIT 1
        `, [userId, orgId]);

        let sessionId;
        if (sessionResult.rows.length === 0) {
            sessionId = crypto.randomUUID();
            await client.query(`
                INSERT INTO work_sessions (id, org_id, user_id, device_id, start_time, status)
                VALUES ($1, $2, $3, 'test-device', $4, 'active')
            `, [sessionId, orgId, userId, new Date()]);
            console.log(`Created new work session: ${sessionId}`);
        } else {
            sessionId = sessionResult.rows[0].id;
            console.log(`Using existing session: ${sessionId}`);
        }

        // Get Uncategorized category
        const categoryResult = await client.query(`
            SELECT id FROM app_categories 
            WHERE org_id = $1 AND name = 'Uncategorized'
            LIMIT 1
        `, [orgId]);

        const uncategorizedId = categoryResult.rows[0]?.id;

        // Sample apps to insert
        const sampleApps = [
            { name: 'chrome.exe', display: 'Google Chrome', duration: 3600 },
            { name: 'code.exe', display: 'Visual Studio Code', duration: 7200 },
            { name: 'slack.exe', display: 'Slack', duration: 1800 },
            { name: 'excel.exe', display: 'Microsoft Excel', duration: 2400 },
            { name: 'spotify.exe', display: 'Spotify', duration: 1200 }
        ];

        console.log('\nInserting sample apps and usage logs...\n');

        for (const app of sampleApps) {
            // Create or get tracked app
            let appResult = await client.query(`
                SELECT id FROM tracked_apps 
                WHERE org_id = $1 AND executable_name = $2
            `, [orgId, app.name]);

            let appId;
            if (appResult.rows.length === 0) {
                appId = crypto.randomUUID();
                await client.query(`
                    INSERT INTO tracked_apps (id, org_id, executable_name, display_name, category_id, is_auto_detected)
                    VALUES ($1, $2, $3, $4, $5, true)
                `, [appId, orgId, app.name, app.display, uncategorizedId]);
                console.log(`  ✓ Created app: ${app.display}`);
            } else {
                appId = appResult.rows[0].id;
                console.log(`  ✓ Using existing app: ${app.display}`);
            }

            // Insert usage log for today
            const now = new Date();
            const startTime = new Date(now.getTime() - app.duration * 1000);
            const logDate = now.toISOString().split('T')[0];

            try {
                await client.query(`
                    INSERT INTO app_usage_logs (id, org_id, user_id, session_id, app_id, window_title, start_time, end_time, duration_seconds, log_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    crypto.randomUUID(),
                    orgId,
                    userId,
                    sessionId,
                    appId,
                    `${app.display} - Test Window`,
                    startTime,
                    now,
                    app.duration,
                    logDate
                ]);
                console.log(`    → Logged ${app.duration}s usage`);
            } catch (error) {
                console.log(`    ⚠️  Could not insert log: ${error.message}`);
            }
        }

        console.log('\n✅ Test data inserted successfully!');
        console.log('\nYou can now view the data in the App Usage Dashboard.');

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        pool.end();
    }
}

insertTestData();
