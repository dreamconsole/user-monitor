import http from 'http';
import { query } from './server/src/db.js';

async function run() {
    const res = await query("SELECT token FROM users WHERE email = 'arun@gmail.com'");
    const token = res.rows[0].token;

    const req = http.request('http://localhost:3000/stats/timeline?view=month&user_id=93ce00b8-0362-4b51-84d4-1e83cc68352b&month=2026-03', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
            console.log(data);
            process.exit(0);
        });
    });
    req.end();
}
run();
