import { getClient } from '../db.js';

async function migrate() {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_state VARCHAR(20) DEFAULT 'offline';`);
        await client.query(`ALTER TABLE org_features ADD COLUMN IF NOT EXISTS idle_action VARCHAR(20) DEFAULT 'none';`);
        await client.query(`ALTER TABLE org_features ADD COLUMN IF NOT EXISTS idle_action_duration_minutes INTEGER DEFAULT 60;`);

        await client.query('COMMIT');
        console.log('Migration added idle tracking successfully completed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
    }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
