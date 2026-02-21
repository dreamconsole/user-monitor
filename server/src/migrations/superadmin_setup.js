import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Adding superadmin to user_role enum if it does not exist...');
        try {
            // ALTER TYPE cannot be run inside a transaction block
            await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';`);
        } catch (e) {
            console.log('user_role enum might not exist, skipping ALTER TYPE. Error:', e.message);
        }

        try {
            // Also try inserting into roles table in case old schema is active
            await client.query(`INSERT INTO roles (name) VALUES ('superadmin') ON CONFLICT DO NOTHING;`);
        } catch (err) {
            console.log('roles table might not exist, skipping. Error:', err.message);
        }

        await client.query('BEGIN');

        console.log('Creating global_settings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS global_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value JSONB,
                description TEXT,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Inserting default global settings...');
        await client.query(`
            INSERT INTO global_settings (setting_key, setting_value, description)
            VALUES 
            ('sso_google_enabled', 'false', 'Enable Google SSO'),
            ('sso_microsoft_enabled', 'false', 'Enable Microsoft SSO'),
            ('sso_apple_enabled', 'false', 'Enable Apple SSO'),
            ('agent_latest_version', '"1.0.0"', 'Latest Agent Version')
            ON CONFLICT (setting_key) DO NOTHING;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
