import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    console.log('Starting migration 011 — domain_productivity use category_id...');
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync('./src/migrations/011_domain_use_category.sql', 'utf8');
        await client.query(sql);
        console.log('✓ Migration 011 completed');
    } catch (error) {
        console.error('✗ Error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
