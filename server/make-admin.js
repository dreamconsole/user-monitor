import { query } from './src/db.js';

async function makeAdmin() {
    try {
        await query("UPDATE users SET role='orgadmin' WHERE email='user@acme.com'");
        console.log("SUCCESS: user@acme.com upgraded to orgadmin.");
        process.exit(0);
    } catch (err) {
        console.error("FAIL:", err);
        process.exit(1);
    }
}
makeAdmin();
