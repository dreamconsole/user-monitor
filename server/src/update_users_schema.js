import { query } from './db.js';

async function updateUsersTable() {
    try {
        console.log('Adding new columns to users table...');

        // 1. Add emp_id (Mandatory for agent users, but we'll allow NULL for migrations and handle in JS)
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS emp_id TEXT');

        // 2. Add payroll_id (Optional)
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS payroll_id TEXT');

        // 3. Add site
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS site TEXT');

        // 4. Add device_id
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id TEXT');

        // 5. Add agent_version
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_version TEXT');

        // 6. Add persistent agent token
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token TEXT');

        // 7. Add last_heartbeat
        await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ');

        console.log('Columns added successfully.');

        // Note: role, password_hash, and force_logout already exist from previous work.
        // We ensure force_logout is boolean and defaults to false.
        await query('ALTER TABLE users ALTER COLUMN force_logout SET DEFAULT false');

        console.log('Database schema updated for Agent Login & Tracking Support!');
        process.exit(0);
    } catch (error) {
        console.error('Error updating users table:', error);
        process.exit(1);
    }
}

updateUsersTable();
