
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    console.log("Connecting...");
    try {
        const client = await pool.connect();
        console.log("Connected.");

        console.log('--- users columns ---');
        const users = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        users.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        console.log('\n--- organizations columns ---');
        const orgs = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations'");
        orgs.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
