import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seed = async () => {
    const client = await pool.connect();
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Drop tables to ensure fresh schema
        await client.query('DROP TABLE IF EXISTS users CASCADE');
        await client.query('DROP TABLE IF EXISTS organizations CASCADE');
        await client.query('DROP TABLE IF EXISTS roles CASCADE');

        await client.query(schemaSql);
        console.log('Schema created successfully');

        // Create Seed Data
        const hashedPassword = await bcrypt.hash('password123', 10);

        // Org 1: Acme Corp
        const org1 = await client.query(
            "INSERT INTO organizations (name, website_url, employee_count, country, industry, timezone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            ['Acme Corp', 'https://acme.com', '11-50', 'USA', 'Tech', 'America/New_York']
        );
        const org1Id = org1.rows[0].id;

        // Org Admin
        const admin1 = await client.query(
            "INSERT INTO users (org_id, name, email, password, role, status, emp_id, job_title) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
            [org1Id, 'Alice Admin', 'admin@acme.com', hashedPassword, 'orgadmin', 'active', 'EMP001', 'CTO']
        );

        // Manager
        const manager1 = await client.query(
            "INSERT INTO users (org_id, name, email, password, role, status, emp_id, job_title) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
            [org1Id, 'Bob Manager', 'manager@acme.com', hashedPassword, 'manager', 'active', 'EMP002', 'Team Lead']
        );

        // User assigned to Manager
        await client.query(
            "INSERT INTO users (org_id, manager_id, name, email, password, role, status, emp_id, job_title) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [org1Id, manager1.rows[0].id, 'Charlie User', 'user@acme.com', hashedPassword, 'user', 'active', 'EMP003', 'Developer']
        );


        // Org 2: Beta Inc (Isolation Test)
        const org2 = await client.query(
            "INSERT INTO organizations (name, website_url, employee_count, country, industry, timezone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            ['Beta Inc', 'https://beta.com', '1-10', 'UK', 'Finance', 'Europe/London']
        );
        const org2Id = org2.rows[0].id;

        await client.query(
            "INSERT INTO users (org_id, name, email, password, role, status, emp_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [org2Id, 'David Admin', 'admin@beta.com', hashedPassword, 'orgadmin', 'active', 'EMP101']
        );

        console.log('Database seeded successfully');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        client.release();
        process.exit();
    }
};

seed();
