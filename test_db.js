import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import pg from 'pg';

pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    const res = await pool.query("SELECT work_date FROM work_sessions ORDER BY start_time DESC LIMIT 1");
    console.log('Work date:', res.rows[0].work_date, typeof res.rows[0].work_date);
    process.exit(0);
}
run();
