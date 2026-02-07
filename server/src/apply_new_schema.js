import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function applySchema() {
    const client = await pool.connect();
    try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'new_schema.sql'), 'utf8');

        console.log('Applying new schema...');

        // This is a destructive action as requested by the user's intent to "replace"
        await client.query(`
            DROP TABLE IF EXISTS audit_logs CASCADE;
            DROP TABLE IF EXISTS break_logs CASCADE;
            DROP TABLE IF EXISTS screenshots CASCADE;
            DROP TABLE IF EXISTS activity_logs CASCADE;
            DROP TABLE IF EXISTS agent_sessions CASCADE;
            DROP TABLE IF EXISTS work_sessions CASCADE;
            DROP TABLE IF EXISTS break_master CASCADE;
            DROP TABLE IF EXISTS user_features CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS org_features CASCADE;
            DROP TABLE IF EXISTS organizations CASCADE;
            DROP TABLE IF EXISTS heartbeats CASCADE;
            DROP TYPE IF EXISTS user_role CASCADE;
            DROP TYPE IF EXISTS session_status CASCADE;
        `);

        await client.query(schemaSql);
        console.log('New schema applied successfully!');
    } catch (err) {
        console.error('Error applying schema:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

applySchema();
