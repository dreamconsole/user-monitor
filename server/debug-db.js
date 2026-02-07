import { query } from './src/db.js';

async function checkData() {
    try {
        console.log('--- activity_logs (Latest 2) ---');
        const activity = await query('SELECT * FROM activity_logs ORDER BY log_time DESC LIMIT 2');
        console.log(JSON.stringify(activity.rows, null, 2));

        console.log('\n--- activity_logs (First 2) ---');
        const activityFirst = await query('SELECT * FROM activity_logs ORDER BY log_time ASC LIMIT 2');
        console.log(JSON.stringify(activityFirst.rows, null, 2));

        console.log('\n--- work_sessions ---');
        const sessions = await query('SELECT * FROM work_sessions ORDER BY start_time DESC LIMIT 5');
        console.table(sessions.rows);

        console.log('\n--- break_logs ---');
        const breaks = await query('SELECT * FROM break_logs ORDER BY start_time DESC LIMIT 5');
        console.table(breaks.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkData();
