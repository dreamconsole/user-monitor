
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars from server root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: add_shift_settings...');
        await client.query('BEGIN');

        // 1. Add columns to organizations
        console.log('Adding columns to organizations...');
        await client.query(`
            ALTER TABLE organizations 
            ADD COLUMN IF NOT EXISTS shift_start_time VARCHAR(10) DEFAULT '09:00',
            ADD COLUMN IF NOT EXISTS shift_end_time VARCHAR(10) DEFAULT '18:00',
            ADD COLUMN IF NOT EXISTS shift_duration DECIMAL(5,2) DEFAULT 9.00,
            ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["Mon", "Tue", "Wed", "Thu", "Fri"]'::jsonb,
            ADD COLUMN IF NOT EXISTS start_of_day VARCHAR(10) DEFAULT '00:00';
        `);

        // 2. Add columns to users (overrides)
        // Nullable means "use org default"
        console.log('Adding columns to users...');
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS shift_start_time VARCHAR(10),
            ADD COLUMN IF NOT EXISTS shift_end_time VARCHAR(10),
            ADD COLUMN IF NOT EXISTS shift_duration DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS work_days JSONB,
            ADD COLUMN IF NOT EXISTS start_of_day VARCHAR(10);
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
