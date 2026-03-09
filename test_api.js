import { query } from './server/src/db.js';
async function run() {
    const res = await query("SELECT user_id, org_id FROM users LIMIT 1");
    const { user_id, org_id } = res.rows[0];
    const data = await query("SELECT work_date, SUM(total_work_seconds) as work_seconds FROM work_sessions GROUP BY work_date");
    console.log("WORK SESSIONS IN DB:", data.rows);
    process.exit(0);
}
run();
