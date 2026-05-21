import { getClient } from '../db.js';

async function migrate() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE org_features
            ADD COLUMN IF NOT EXISTS shift_grace_minutes INTEGER DEFAULT 5;
        `);
        await client.query(`
            ALTER TABLE org_features
            ADD COLUMN IF NOT EXISTS shift_absence_minutes INTEGER DEFAULT 120;
        `);
        await client.query(`
            ALTER TABLE org_features
            ADD COLUMN IF NOT EXISTS shift_absence_action VARCHAR(20) DEFAULT 'logout';
        `);

        await client.query('COMMIT');
        console.log('Migration 014: shift grace policy columns added');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration 014 failed:', e);
        throw e;
    } finally {
        client.release();
    }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
