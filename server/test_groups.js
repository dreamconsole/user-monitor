import { query } from './src/db.js';

async function test() {
    const res = await query(`SELECT * FROM break_groups`);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
test();
