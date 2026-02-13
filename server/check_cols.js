
import { query } from './src/db.js';

console.log("Starting checkColumns...");

async function checkColumns() {
    try {
        console.log('--- users table ---');
        const users = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log("Users columns:", users.rows.map(r => r.column_name).join(', '));

        console.log('--- organizations table ---');
        const orgs = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'organizations'
        `);
        console.log("Orgs columns:", orgs.rows.map(r => r.column_name).join(', '));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        console.log("Done.");
        process.exit(0);
    }
}

checkColumns();
