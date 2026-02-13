const pg = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'src', 'migrations', '007_add_app_tracking.sql'), 'utf8');

        console.log('Running migration 007_add_app_tracking.sql...');
        await client.query(sql);
        console.log('✓ Migration completed successfully');

        // Verify tables were created
        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('app_categories', 'tracked_apps', 'app_usage_logs', 'user_app_summary')
            ORDER BY table_name
        `);

        console.log('\n✓ Created tables:');
        result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        console.error(error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
