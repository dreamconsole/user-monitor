import { getClient } from '../db.js';

async function migrate() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS team_manager_links (
                team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (team_id, user_id)
            )
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_team_manager_links_user_id
            ON team_manager_links(user_id)
        `);

        await client.query(`
            INSERT INTO team_manager_links (team_id, user_id)
            SELECT u.team_id, u.id
            FROM users u
            WHERE u.team_id IS NOT NULL
              AND u.role IN ('manager', 'orgadmin')
              AND u.is_active = true
            ON CONFLICT DO NOTHING
        `);

        await client.query('COMMIT');
        console.log('Migration 012_team_manager_links completed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration 012_team_manager_links failed:', e);
        throw e;
    } finally {
        client.release();
    }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
