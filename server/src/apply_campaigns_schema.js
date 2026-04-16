const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adding is_campaigns_enabled to org_features...');
        await client.query(`
            ALTER TABLE org_features
            ADD COLUMN IF NOT EXISTS is_campaigns_enabled BOOLEAN DEFAULT false;
        `);

        console.log('Creating campaigns table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Creating campaign_assignments table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaign_assignments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT check_assignment_target CHECK (
                    (team_id IS NOT NULL AND user_id IS NULL) OR 
                    (user_id IS NOT NULL AND team_id IS NULL)
                ),
                UNIQUE(campaign_id, team_id),
                UNIQUE(campaign_id, user_id)
            );
        `);

        console.log('Adding campaign_id to work_sessions...');
        await client.query(`
            ALTER TABLE work_sessions
            ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
