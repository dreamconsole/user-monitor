import { query } from './server/src/db.js';

async function run() {
    try {
        const result = await query("SELECT email, timezone FROM users");
        console.log('User timezones:', result.rows);
    } catch (err) {
        console.error('Failed to fetch:', err.message);
    }
}

run();
