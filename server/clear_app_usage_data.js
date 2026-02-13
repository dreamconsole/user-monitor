import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function clearAppUsageData() {
    const client = await pool.connect();
    try {
        console.log('=== Clearing App Usage Data ===\n');

        // Check current counts before deletion
        const beforeCounts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM app_usage_logs) as usage_logs,
                (SELECT COUNT(*) FROM tracked_apps) as tracked_apps,
                (SELECT COUNT(*) FROM user_app_summary) as summaries
        `);

        console.log('Before deletion:');
        console.log(`  - App usage logs: ${beforeCounts.rows[0].usage_logs}`);
        console.log(`  - Tracked apps: ${beforeCounts.rows[0].tracked_apps}`);
        console.log(`  - User summaries: ${beforeCounts.rows[0].summaries}`);
        console.log('');

        // Delete app usage logs (this will cascade to related data)
        console.log('Deleting app usage logs...');
        const logsResult = await client.query('DELETE FROM app_usage_logs');
        console.log(`✓ Deleted ${logsResult.rowCount} app usage logs`);

        // Delete tracked apps (optional - keeps categories)
        console.log('Deleting tracked apps...');
        const appsResult = await client.query('DELETE FROM tracked_apps');
        console.log(`✓ Deleted ${appsResult.rowCount} tracked apps`);

        // Delete user summaries
        console.log('Deleting user app summaries...');
        const summaryResult = await client.query('DELETE FROM user_app_summary');
        console.log(`✓ Deleted ${summaryResult.rowCount} user summaries`);

        console.log('\n✅ All app usage data cleared!');
        console.log('\nNext steps:');
        console.log('1. Start the electron agent: cd electron-agent && npm start');
        console.log('2. Login to the agent');
        console.log('3. Click "Start Tracking"');
        console.log('4. Use your computer normally for 2-3 minutes');
        console.log('5. Wait 60 seconds for sync');
        console.log('6. Check database: node check_app_usage_data.js');
        console.log('7. Refresh dashboard to see real tracking data');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

clearAppUsageData();
