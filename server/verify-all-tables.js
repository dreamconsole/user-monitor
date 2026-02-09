import { query } from './src/db.js';

async function checkAllTables() {
    const tables = [
        'users', 'organizations', 'devices', 
        'work_sessions', 'activity_logs', 'break_logs', 
        'screenshots', 'heartbeat_logs'
    ];

    console.log('--- Checking Tables ---');
    try {
        for (const table of tables) {
            const res = await query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            `, [table]);

            if (res.rows.length > 0) {
                console.log(`✅ ${table} exists`);
            } else {
                console.log(`❌ ${table} MISSING`);
            }
        }
    } catch (e) {
        console.error('Error checking tables:', e);
    } finally {
        process.exit();
    }
}

checkAllTables();
