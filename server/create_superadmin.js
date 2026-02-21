import bcrypt from 'bcryptjs';
import { query } from './src/db.js';

async function createSuperAdmin() {
    try {
        console.log('Connecting to database...');

        // 1. Ensure an organization exists or create a default "System Admin" org
        let orgId;
        const orgRes = await query(`SELECT id FROM organizations WHERE name = 'System Administration' LIMIT 1`);

        if (orgRes.rows.length > 0) {
            orgId = orgRes.rows[0].id;
            console.log('System Administration org found:', orgId);
        } else {
            console.log('Creating System Administration org...');
            const orgInsert = await query(`
                INSERT INTO organizations (name, domain, max_users_limit, is_active)
                VALUES ('System Administration', 'sysadmin.local', 9999, true)
                RETURNING id
            `);
            orgId = orgInsert.rows[0].id;
        }

        // 2. Create the superadmin user
        const email = 'superadmin@example.com';
        const password = 'superuser123';
        const hashedPassword = await bcrypt.hash(password, 10);

        const checkUser = await query(`SELECT id FROM users WHERE email = $1`, [email]);

        if (checkUser.rows.length > 0) {
            console.log(`User ${email} already exists. Updating role to superadmin...`);
            await query(`UPDATE users SET role = 'superadmin' WHERE email = $1`, [email]);
        } else {
            console.log(`Creating superadmin user: ${email}...`);
            await query(`
                INSERT INTO users (org_id, full_name, email, password_hash, role, timezone, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [orgId, 'Super Admin', email, hashedPassword, 'superadmin', 'UTC', true]);
        }

        console.log('===================================================');
        console.log('Superadmin User Created/Updated Successfully');
        console.log('Email: superadmin@example.com');
        console.log('Password: superuser123');
        console.log('===================================================');

    } catch (error) {
        console.error('Error creating superadmin:', error);
    } finally {
        // give it a second and exit
        setTimeout(() => process.exit(0), 1000);
    }
}

createSuperAdmin();
