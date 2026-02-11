import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Clearing existing data (if any)...');
        // Note: New schema uses CASCADE, but for safety in seed script:
        await client.query('TRUNCATE organizations CASCADE');

        console.log('Seeding Organizations...');
        const orgRes = await client.query(`
            INSERT INTO organizations (name, domain, max_users_limit)
            VALUES ('Acme Corp', 'acme.com', 50)
            RETURNING id
        `);
        const orgId = orgRes.rows[0].id;

        console.log('Seeding Org Features...');
        await client.query(`
            INSERT INTO org_features (org_id, screenshot_interval_seconds, afk_threshold_seconds)
            VALUES ($1, 60, 180)
        `, [orgId]);

        console.log('Seeding Users...');
        const hashedPassword = await bcrypt.hash('password123', 10);

        const adminRes = await client.query(`
            INSERT INTO users (org_id, full_name, email, password_hash, role, timezone)
            VALUES ($1, 'Admin User', 'admin@acme.com', $2, 'orgadmin', 'Asia/Kolkata')
            RETURNING id
        `, [orgId, hashedPassword]);
        const adminId = adminRes.rows[0].id;

        const managerRes = await client.query(`
            INSERT INTO users (org_id, manager_id, full_name, email, password_hash, role, timezone)
            VALUES ($1, $2, 'Manager User', 'manager@acme.com', $3, 'manager', 'Asia/Kolkata')
            RETURNING id
        `, [orgId, adminId, hashedPassword]);
        const managerId = managerRes.rows[0].id;

        const userRes = await client.query(`
            INSERT INTO users (org_id, manager_id, full_name, email, password_hash, role, timezone)
            VALUES ($1, $2, 'Standard User', 'user@acme.com', $3, 'user', 'Asia/Kolkata')
            RETURNING id
        `, [orgId, managerId, hashedPassword]);
        const userId = userRes.rows[0].id;

        console.log('Seeding Break Master...');
        const breakRes = await client.query(`
            INSERT INTO break_master (org_id, name, max_duration_seconds, is_paid)
            VALUES 
                ($1, 'Lunch Break', 3600, true),
                ($1, 'Tea', 900, true),
                ($1, 'Personal', 600, false)
            RETURNING id, name
        `, [orgId]);
        const breakId = breakRes.rows.find(r => r.name === 'Lunch Break').id;

        console.log('Seeding Work Session...');
        const sessionRes = await client.query(`
            INSERT INTO work_sessions (org_id, user_id, status, work_date)
            VALUES ($1, $2, 'active', CURRENT_DATE)
            RETURNING id
        `, [orgId, userId]);
        const sessionId = sessionRes.rows[0].id;

        console.log('Seeding Activity Logs (Partitioned)...');
        await client.query(`
            INSERT INTO activity_logs (org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 50, 20, 'active')
        `, [orgId, userId, sessionId]);

        console.log('Seeding Agent Session...');
        await client.query(`
            INSERT INTO agent_sessions (user_id, org_id, device_name, auth_token, token_expires_at)
            VALUES ($1, $2, 'MacBook Pro', 'test_token_123', CURRENT_TIMESTAMP + INTERVAL '30 days')
        `, [userId, orgId]);

        await client.query('COMMIT');
        console.log('Seeding completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding database:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
