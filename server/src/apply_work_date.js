import { query } from './db.js';

async function applyWorkDate() {
    try {
        console.log('Adding work_date column to work_sessions...');
        await query('ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS work_date DATE');

        console.log('Backfilling work_date based on start_time AT TIME ZONE user timezone...');
        // This is a bit tricky since we need the user's timezone.
        // We'll join with users to get the timezone.
        await query(`
            UPDATE work_sessions ws
            SET work_date = (ws.start_time AT TIME ZONE COALESCE(u.timezone, 'UTC'))::DATE
            FROM users u
            WHERE ws.user_id = u.id AND ws.work_date IS NULL
        `);

        console.log('Adding index on work_date...');
        await query('CREATE INDEX IF NOT EXISTS idx_work_sessions_work_date ON work_sessions(org_id, work_date)');

        console.log('Database schema updated successfully with work_date!');
        process.exit(0);
    } catch (error) {
        console.error('Error applying work_date schema:', error);
        process.exit(1);
    }
}

applyWorkDate();
