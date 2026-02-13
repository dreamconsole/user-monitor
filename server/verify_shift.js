
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

function log(msg) {
    fs.appendFileSync('verify_shift_output.txt', JSON.stringify(msg, null, 2) + '\n');
    console.log(msg);
}

async function verify() {
    const client = await pool.connect();
    try {
        log('Verifying Shift Settings...');

        // 1. Get an existing Org that has users
        const orgRes = await client.query(`
            SELECT o.id, o.name 
            FROM organizations o 
            JOIN users u ON u.org_id = o.id 
            LIMIT 1
        `);
        if (orgRes.rows.length === 0) {
            log('No organizations with users found to test with.');
            return;
        }
        const orgId = orgRes.rows[0].id;
        log(`Testing with Org: ${orgRes.rows[0].name} (${orgId})`);

        // 2. Update Org Settings
        const days = JSON.stringify(["Mon", "Wed", "Fri"]);
        await client.query(`
            UPDATE organizations 
            SET shift_start_time = '10:00', shift_end_time = '19:00', shift_duration = 8.5, work_days = $1
            WHERE id = $2
        `, [days, orgId]);
        log('Updated Org Settings');

        // 3. Verify Org Settings
        const orgCheck = await client.query('SELECT shift_start_time, work_days FROM organizations WHERE id = $1', [orgId]);
        log('Org Settings Readback:');
        log(orgCheck.rows[0]);

        // 4. Get a user
        const userRes = await client.query('SELECT id, full_name FROM users WHERE org_id = $1 LIMIT 1', [orgId]);
        if (userRes.rows.length === 0) {
            log('No users found in this org.');
        } else {
            const userId = userRes.rows[0].id;
            log(`Testing with User: ${userRes.rows[0].full_name} (${userId})`);

            // 5. Update User Override
            await client.query(`
                UPDATE users
                SET shift_start_time = '11:00', shift_end_time = '20:00', work_days = '["Tue", "Thu"]'::jsonb
                WHERE id = $1
            `, [userId]);
            log('Updated User Settings');

            // 6. Verify User Settings
            const userCheck = await client.query('SELECT shift_start_time, work_days FROM users WHERE id = $1', [userId]);
            log('User Settings Readback:');
            log(userCheck.rows[0]);
        }

    } catch (e) {
        log('Verification failed: ' + e.message);
    } finally {
        client.release();
        pool.end();
        process.exit(0);
    }
}

verify();
