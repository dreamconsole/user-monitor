import { query } from './src/db.js';

async function test() {
    const res = await query('SELECT full_name, email, role, team_id FROM users WHERE full_name ILIKE $1', ['%Admin%']);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
test();
