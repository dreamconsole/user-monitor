import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    console.log('Starting migration...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

    const client = await pool.connect();
    try {
        const sql = fs.readFileSync('./src/migrations/007_add_app_tracking.sql', 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('✓ Migration completed');

        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('app_categories', 'tracked_apps', 'app_usage_logs', 'user_app_summary')
        `);

        console.log('✓ Tables created:', result.rows.map(r => r.table_name));

    } catch (error) {
        console.error('✗ Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
