import { query } from './src/db.js';

async function checkSchema() {
    try {
        console.log('--- activity_logs Schema ---');
        const res = await query(`
            SELECT column_name, data_type, ordinal_position 
            FROM information_schema.columns 
            WHERE table_name = 'activity_logs'
            ORDER BY ordinal_position
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkSchema();
