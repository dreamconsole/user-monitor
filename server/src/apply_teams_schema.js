import { query } from './db.js';

async function applyTeamsSchema() {
    try {
        console.log('Creating teams table...');

        await query(`
            CREATE TABLE IF NOT EXISTS teams (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Teams table created successfully.');

        console.log('Adding team_id to users table...');

        await query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
        `);

        // We don't drop manager_id immediately in case of rollback, but we can set it to nullable if not already
        console.log('team_id column added successfully.');

        console.log('Database schema updated for Team Module!');
        process.exit(0);
    } catch (error) {
        console.error('Error updating teams schema:', error);
        process.exit(1);
    }
}

applyTeamsSchema();
