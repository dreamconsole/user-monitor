import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('migration_check.txt', msg + '\n');
};

async function checkTables() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('app_categories', 'tracked_apps', 'app_usage_logs', 'user_app_summary')
            ORDER BY table_name
        `);

        log('App Tracking Tables:');
        if (result.rows.length === 0) {
            log('  No tables found - migration may not have run');
        } else {
            result.rows.forEach(row => log(`  ✓ ${row.table_name}`));
        }

        // Check for default categories
        const categories = await client.query(`
            SELECT name, productivity_type 
            FROM app_categories 
            LIMIT 10
        `);

        log('\nDefault Categories:');
        categories.rows.forEach(cat => log(`  - ${cat.name} (${cat.productivity_type})`));

    } catch (error) {
        log('Error: ' + error.message);
    } finally {
        client.release();
        pool.end();
    }
}

checkTables();
