
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

function log(msg) {
    fs.appendFileSync('list_users_output.txt', JSON.stringify(msg, null, 2) + '\n');
    console.log(msg);
}

async function run() {
    const client = await pool.connect();
    try {
        log('Listing Organizations...');
        const orgs = await client.query('SELECT id, name FROM organizations');
        log(orgs.rows);

        log('Listing Users...');
        const users = await client.query('SELECT id, full_name, org_id FROM users');
        log(users.rows);

    } catch (e) {
        log('Error: ' + e.message);
    } finally {
        client.release();
        pool.end();
        process.exit(0);
    }
}

run();
