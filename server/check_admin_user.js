import { query } from './src/db.js';

async function test() {
    const res = await query('SELECT full_name, email, role FROM users WHERE full_name = $1', ['Admin User']);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
test();
