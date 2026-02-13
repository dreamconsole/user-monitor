import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkDates() {
    const client = await pool.connect();
    try {
        console.log('=== Checking Data Dates ===');
        const res = await client.query(`
            SELECT 
                MIN(start_time) as first_log,
                MAX(start_time) as last_log,
                COUNT(*) as total_logs
            FROM app_usage_logs
        `);
        console.log('Data Range:', res.rows[0]);

        const today = new Date().toISOString().split('T')[0];
        console.log('Today is:', today);

        const todayLogs = await client.query(`
            SELECT COUNT(*) FROM app_usage_logs 
            WHERE DATE(start_time) = $1
        `, [today]);
        console.log(`Logs for Today (${today}):`, todayLogs.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
checkDates();
