import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'server/.env'), override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkUser(email) {
    try {
        const userRes = await pool.query('SELECT id, full_name, email, last_heartbeat FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            console.log('User not found.');
            return;
        }
        const user = userRes.rows[0];
        console.log('User Data:', JSON.stringify(user, null, 2));

        const breakRes = await pool.query('SELECT * FROM break_logs WHERE user_id = $1 AND end_time IS NULL ORDER BY start_time DESC', [user.id]);
        console.log('Open Breaks:', JSON.stringify(breakRes.rows, null, 2));

        const sessionRes = await pool.query('SELECT id, start_time, end_time, status FROM work_sessions WHERE user_id = $1 AND DATE(start_time) = CURRENT_DATE', [user.id]);
        console.log('Work Sessions Today:', JSON.stringify(sessionRes.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUser('user5@acme.com');
