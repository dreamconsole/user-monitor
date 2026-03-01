import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function debug() {
    const client = await pool.connect();
    try {
        // 1. Check if table exists
        const tableCheck = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'browser_activity_logs'
        `);
        console.log('Table exists:', tableCheck.rows.length > 0);

        if (tableCheck.rows.length === 0) {
            console.log('ERROR: browser_activity_logs table does not exist!');
            return;
        }

        // 2. Print all columns
        const cols = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'browser_activity_logs'
            ORDER BY ordinal_position
        `);
        console.log('Columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

        // 3. Try the exact query from getBrowserActivityDetails
        const userId = (await client.query('SELECT id FROM users LIMIT 1')).rows[0]?.id;
        const orgId = (await client.query('SELECT id FROM organizations LIMIT 1')).rows[0]?.id;
        if (!userId || !orgId) { console.log('No users/orgs found'); return; }

        console.log('Testing query with userId:', userId, 'orgId:', orgId);

        const result = await client.query(`
            SELECT 
                COALESCE(bal.domain, bal.title) as domain,
                bal.browser,
                bal.source,
                COUNT(*) as visit_count,
                SUM(bal.duration_seconds) as total_seconds,
                MAX(bal.title) as last_title
            FROM browser_activity_logs bal
            WHERE bal.user_id = $1 AND bal.org_id = $2
            AND bal.start_time::date >= $3::date AND bal.start_time::date <= $4::date
            GROUP BY COALESCE(bal.domain, bal.title), bal.browser, bal.source
            ORDER BY total_seconds DESC
            LIMIT 5
        `, [userId, orgId, '2026-03-01', '2026-03-01']);

        console.log('Query OK! Row count:', result.rows.length);
        if (result.rows.length > 0) console.log('Sample row:', result.rows[0]);

    } catch (e) {
        console.error('QUERY ERROR:', e.message);
        console.error('Detail:', e.detail || '');
        console.error('Hint:', e.hint || '');
    } finally {
        client.release();
        pool.end();
    }
}

debug();
