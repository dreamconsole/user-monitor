const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ override: true });

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.split('@')[1] + ')' : 'NOT SET');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debug() {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to DB OK');

        // Check table
        const tableCheck = await client.query(`
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = 'browser_activity_logs'
            ORDER BY ordinal_position
        `);

        if (tableCheck.rows.length === 0) {
            console.log('ERROR: browser_activity_logs table does NOT exist. Run migrations 003/004 first.');
            return;
        }
        console.log('Columns:', tableCheck.rows.map(r => r.column_name).join(', '));

        // Get real user/org
        const userRow = (await client.query('SELECT id FROM users LIMIT 1')).rows[0];
        const orgRow = (await client.query('SELECT id FROM organizations LIMIT 1')).rows[0];

        if (!userRow || !orgRow) { console.log('No user/org rows found.'); return; }
        console.log('User:', userRow.id, 'Org:', orgRow.id);

        // Test the exact query
        const r = await client.query(`
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
        `, [userRow.id, orgRow.id, '2026-03-01', '2026-03-01']);

        console.log('Query OK — rows returned:', r.rows.length);

    } catch (e) {
        console.error('FAILED:', e.message);
        if (e.detail) console.error('Detail:', e.detail);
        if (e.hint) console.error('Hint:', e.hint);
        if (e.where) console.error('Where:', e.where);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

debug();
