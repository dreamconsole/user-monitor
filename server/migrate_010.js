import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    console.log('Starting migration 010 — domain_productivity...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

    const client = await pool.connect();
    try {
        const sql = fs.readFileSync('./src/migrations/010_domain_productivity.sql', 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('✓ Migration 010 completed');

        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'domain_productivity'
        `);

        console.log('✓ Tables confirmed:', result.rows.map(r => r.table_name));

    } catch (error) {
        console.error('✗ Error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
