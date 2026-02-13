import { query } from './src/db.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkNotifications() {
    try {
        const res = await query('SELECT id, org_id, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 5');
        console.log('Recent Notifications:', res.rows);
    } catch (err) {
        console.error(err);
    }
}

checkNotifications();
