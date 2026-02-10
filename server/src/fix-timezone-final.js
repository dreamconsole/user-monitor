import { query } from './db.js';

async function run() {
    try {
        console.log('--- Database Timezone Migration ---');

        // Fix users
        const users = await query("UPDATE users SET timezone = 'Asia/Kolkata' WHERE timezone = 'Asia/Calcutta' RETURNING email");
        console.log(`Updated ${users.rowCount} users:`, users.rows.map(u => u.email).join(', '));

        // Fix organizations
        const orgs = await query("UPDATE organizations SET timezone = 'Asia/Kolkata' WHERE timezone = 'Asia/Calcutta' RETURNING name");
        console.log(`Updated ${orgs.rowCount} organizations:`, orgs.rows.map(o => o.name).join(', '));

        // List current unique timezones to spot other issues
        const zones = await query("SELECT DISTINCT timezone FROM users");
        console.log('Current timezones in users table:', zones.rows.map(z => z.timezone));

        console.log('--- Done ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

run();
