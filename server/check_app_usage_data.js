import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkAppUsageData() {
    const client = await pool.connect();
    try {
        console.log('=== Checking App Tracking Tables ===\n');

        // Check if tables exist
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('app_categories', 'tracked_apps', 'app_usage_logs', 'user_app_summary')
            ORDER BY table_name
        `);
        console.log('Tables found:', tablesResult.rows.map(r => r.table_name));

        // Check app_categories
        const categoriesResult = await client.query('SELECT id, name, productivity_type FROM app_categories LIMIT 10');
        console.log('\n=== App Categories ===');
        console.log(`Total: ${categoriesResult.rows.length}`);
        categoriesResult.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.productivity_type})`);
        });

        // Check tracked_apps
        const appsResult = await client.query(`
            SELECT ta.id, ta.executable_name, ta.display_name, ac.name as category_name
            FROM tracked_apps ta
            LEFT JOIN app_categories ac ON ta.category_id = ac.id
            LIMIT 10
        `);
        console.log('\n=== Tracked Apps ===');
        console.log(`Total: ${appsResult.rows.length}`);
        appsResult.rows.forEach(row => {
            console.log(`  - ${row.executable_name} → ${row.category_name || 'Uncategorized'}`);
        });

        // Check app_usage_logs (all partitions)
        const usageLogsResult = await client.query(`
            SELECT COUNT(*) as count FROM app_usage_logs
        `);
        console.log('\n=== App Usage Logs ===');
        console.log(`Total logs: ${usageLogsResult.rows[0].count}`);

        if (parseInt(usageLogsResult.rows[0].count) > 0) {
            const sampleLogs = await client.query(`
                SELECT aul.*, ta.executable_name, ta.display_name
                FROM app_usage_logs aul
                JOIN tracked_apps ta ON aul.app_id = ta.id
                ORDER BY aul.start_time DESC
                LIMIT 5
            `);
            console.log('\nRecent logs:');
            sampleLogs.rows.forEach(log => {
                console.log(`  - ${log.executable_name}: ${log.duration_seconds}s at ${log.start_time}`);
            });
        } else {
            console.log('⚠️  No app usage logs found in database!');
        }

        // Check user_app_summary
        const summaryResult = await client.query('SELECT COUNT(*) as count FROM user_app_summary');
        console.log('\n=== User App Summary ===');
        console.log(`Total summaries: ${summaryResult.rows[0].count}`);

        // Check work sessions
        const sessionsResult = await client.query(`
            SELECT COUNT(*) as count, MAX(start_time) as latest_session
            FROM work_sessions
            WHERE status = 'active'
        `);
        console.log('\n=== Work Sessions ===');
        console.log(`Active sessions: ${sessionsResult.rows[0].count}`);
        console.log(`Latest session: ${sessionsResult.rows[0].latest_session || 'None'}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

checkAppUsageData();
