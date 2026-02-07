import { query } from './db.js';

async function applyTimezoneUpdates() {
    try {
        console.log('Adding timezone columns...');

        // 1. Add timezone to organizations
        await query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC'`);

        // 2. Add timezone to users
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT`);

        // 3. Ensure all relevant columns are TIMESTAMPTZ (already mostly done in new_schema, but for safety)
        console.log('Verifying TIMESTAMPTZ types...');
        const columnsToUpdate = [
            ['work_sessions', 'start_time'],
            ['work_sessions', 'end_time'],
            ['activity_logs', 'log_time'],
            ['break_logs', 'start_time'],
            ['break_logs', 'end_time'],
            ['screenshots', 'captured_at'],
            ['agent_sessions', 'last_heartbeat_at']
        ];

        for (const [table, column] of columnsToUpdate) {
            try {
                await query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE TIMESTAMPTZ`);
                console.log(`  - ${table}.${column} updated/verified.`);
            } catch (err) {
                console.warn(`  - Skipping ${table}.${column}: ${err.message}`);
            }
        }

        console.log('Database timezone updates applied successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Failed to apply timezone updates:', error);
        process.exit(1);
    }
}

applyTimezoneUpdates();
