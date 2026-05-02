import { query } from './src/db.js';

async function test() {
    const res = await query('SELECT DISTINCT role FROM users');
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
test();
