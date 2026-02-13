
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

function log(msg) {
    fs.appendFileSync('test_features_output.txt', JSON.stringify(msg, null, 2) + '\n');
    console.log(msg);
}

async function test() {
    const client = await pool.connect();
    try {
        log('Testing User Features Query...');

        // 1. Get an existing Org
        const orgRes = await client.query('SELECT id FROM organizations LIMIT 1');
        if (orgRes.rows.length === 0) {
            log('No orgs found');
            return;
        }
        const orgId = orgRes.rows[0].id;
        log(`Testing with Org ID: ${orgId}`);

        // 2. Run the query from userFeaturesController
        const res = await client.query(`
            SELECT 
                of.*,
                o.shift_start_time, o.shift_end_time, o.shift_duration, o.work_days
            FROM org_features of
            JOIN organizations o ON o.id = of.org_id
            WHERE of.org_id = $1
        `, [orgId]);

        log('Query Result:');
        log(res.rows[0]);

        if (!res.rows[0]) {
            log('No org_features found. Trying separate query fallback...');
            const orgOnly = await client.query('SELECT shift_start_time, shift_end_time, shift_duration, work_days FROM organizations WHERE id = $1', [orgId]);
            log('Fallback Result:');
            log(orgOnly.rows[0]);
        }

    } catch (e) {
        log('Error: ' + e.message);
    } finally {
        client.release();
        pool.end();
    }
}

test();
