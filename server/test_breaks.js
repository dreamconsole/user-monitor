import { query } from './src/db.js';

async function test() {
    const res = await query(`
        SELECT bm.*, bg.name as group_name 
        FROM break_master bm
        JOIN break_groups bg ON bm.break_group_id = bg.id
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
test();
