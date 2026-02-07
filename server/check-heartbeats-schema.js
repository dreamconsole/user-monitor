import { query } from './src/db.js';

async function checkHeartbeatsSchema() {
    try {
        console.log('--- heartbeats Schema ---');
        const res = await query(`
            SELECT column_name, data_type, ordinal_position 
            FROM information_schema.columns 
            WHERE table_name = 'heartbeats'
            ORDER BY ordinal_position
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkHeartbeatsSchema();
