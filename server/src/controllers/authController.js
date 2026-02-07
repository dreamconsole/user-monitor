import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export const registerOrg = async (req, res) => {
    const {
        orgName,
        websiteUrl,
        employeeCount,
        country,
        industry,
        timezone,
        userName,
        email,
        password
    } = req.body;

    try {
        // Start transaction
        await query('BEGIN');

        // Check if user exists
        const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            await query('ROLLBACK');
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create Org
        // Adjusted column names to match new_schema: domain instead of website_url
        // employee_count, country, industry, timezone are NOT in new_schema.sql currently
        // I will only insert what is in the schema to avoid errors.
        const orgResult = await query(
            'INSERT INTO organizations (name, domain, timezone) VALUES ($1, $2, $3) RETURNING id',
            [orgName, websiteUrl, timezone || 'UTC']
        );
        const orgId = orgResult.rows[0].id;

        // Initialize Org Features
        await query(
            'INSERT INTO org_features (org_id) VALUES ($1)',
            [orgId]
        );

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create User (orgadmin)
        // full_name instead of name, password_hash instead of password
        const userResult = await query(
            'INSERT INTO users (org_id, full_name, email, password_hash, role, timezone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, timezone',
            [orgId, userName, email, hashedPassword, 'orgadmin', timezone || 'UTC']
        );
        const user = userResult.rows[0];

        await query('COMMIT');

        const token = jwt.sign(
            { id: user.id, org_id: orgId, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({ token, user: { id: user.id, name: userName, email, role: user.role, org_id: orgId, timezone: user.timezone } });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        // Support both schema: password_hash (new) or password (legacy)
        const passwordHash = user.password_hash ?? user.password;
        if (!passwordHash) {
            return res.status(500).json({ error: 'Login failed: user record invalid' });
        }
        const validPassword = await bcrypt.compare(password, passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isActive = user.is_active !== undefined ? user.is_active : user.status !== 'suspended';
        if (!isActive) {
            return res.status(403).json({ error: 'Account suspended' });
        }

        // Update last login (only when using new schema with last_login_at)
        if (user.password_hash != null) {
            try {
                await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
            } catch (_) { /* column may not exist in legacy schema */ }
        }

        const token = jwt.sign(
            { id: user.id, org_id: user.org_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        const userName = user.full_name ?? user.name;
        res.json({ token, user: { id: user.id, name: userName, email: user.email, role: user.role, org_id: user.org_id, timezone: user.timezone } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
};

export const getMe = async (req, res) => {
    try {
        const result = await query(
            'SELECT u.id, u.full_name as name, u.email, u.role, u.org_id, u.timezone, o.name as org_name FROM users u JOIN organizations o ON u.org_id = o.id WHERE u.id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({ error: 'Fetch failed: ' + error.message });
    }
};
