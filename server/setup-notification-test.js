import { query } from './src/db.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkUser() {
    try {
        const res = await query(`
            SELECT id, full_name, role, manager_id, email 
            FROM users 
            WHERE email = 'user@acme.com'
        `);
        console.log('User Details:', res.rows[0]);

        if (res.rows[0].manager_id) {
            const managerRes = await query('SELECT id, full_name, email, role FROM users WHERE id = $1', [res.rows[0].manager_id]);
            console.log('Manager Details:', managerRes.rows[0]);
        } else {
            console.log('User has NO Manager.');

            // Create a manager if none exists
            console.log('Creating a dummy manager...');
            const orgIdRes = await query(`SELECT org_id FROM users WHERE email = 'user@acme.com'`);
            const orgId = orgIdRes.rows[0].org_id;

            const managerInsert = await query(`
                INSERT INTO users (org_id, full_name, email, password_hash, role)
                VALUES ($1, 'Test Manager', 'manager@acme.com', 'hash', 'manager')
                ON CONFLICT (org_id, email) DO UPDATE SET role = 'manager'
                RETURNING id
            `, [orgId]);

            const managerId = managerInsert.rows[0].id;
            console.log('Created/Found Manager ID:', managerId);

            // Assign to user
            await query('UPDATE users SET manager_id = $1 WHERE email = $2', [managerId, 'user@acme.com']);
            console.log('Assigned Manager to User.');
        }

    } catch (err) {
        console.error(err);
    }
}

checkUser();
