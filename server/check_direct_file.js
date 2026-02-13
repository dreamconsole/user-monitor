
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

function log(msg) {
    fs.appendFileSync('schema_output.txt', msg + '\n');
    console.log(msg);
}

async function run() {
    log("Connecting...");
    try {
        const client = await pool.connect();
        log("Connected.");

        log('--- users columns ---');
        const users = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        users.rows.forEach(r => log(`${r.column_name} (${r.data_type})`));

        log('\n--- organizations columns ---');
        const orgs = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations'");
        orgs.rows.forEach(r => log(`${r.column_name} (${r.data_type})`));

        client.release();
    } catch (e) {
        log("Error: " + e.message);
    } finally {
        pool.end();
        process.exit(0);
    }
}

run();
