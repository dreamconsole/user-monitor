
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: add left_clicks and right_clicks to activity_logs...');
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE activity_logs
            ADD COLUMN IF NOT EXISTS left_clicks INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS right_clicks INTEGER DEFAULT 0;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully. Columns left_clicks and right_clicks added to activity_logs.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
