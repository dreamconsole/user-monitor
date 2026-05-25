import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { query, getClient } from '../db.js';
import { markUserShiftOffline } from '../lib/presence.js';

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);


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

    // Input validation
    if (!orgName || !userName || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields: orgName, userName, email, password' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (typeof orgName !== 'string' || orgName.trim().length < 2) {
        return res.status(400).json({ error: 'Organization name must be at least 2 characters' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Check if user exists
        const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create Org
        const orgResult = await client.query(
            'INSERT INTO organizations (name, domain, timezone) VALUES ($1, $2, $3) RETURNING id',
            [orgName.trim(), websiteUrl || null, timezone || 'UTC']
        );
        const orgId = orgResult.rows[0].id;

        // Initialize Org Features
        await client.query(
            'INSERT INTO org_features (org_id) VALUES ($1)',
            [orgId]
        );

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create User (orgadmin)
        const userResult = await client.query(
            'INSERT INTO users (org_id, full_name, email, password_hash, role, timezone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, timezone',
            [orgId, userName.trim(), email.toLowerCase().trim(), hashedPassword, 'orgadmin', timezone || 'UTC']
        );
        const user = userResult.rows[0];

        await client.query('COMMIT');

        const token = jwt.sign(
            { id: user.id, org_id: orgId, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({ 
            token, 
            user: { 
                id: user.id, 
                name: userName, 
                email, 
                role: user.role, 
                org_id: orgId, 
                org_name: orgName.trim(),
                timezone: user.timezone,
                features: {
                    is_campaigns_enabled: false,
                    is_breaks_enabled: true
                }
            } 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    } finally {
        client.release();
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await query(`
            SELECT u.*, 
                   o.name as org_name,
                   o.primary_color_light as org_primary_color_light, 
                   o.primary_color_dark as org_primary_color_dark, 
                   o.timezone as org_timezone,
                   COALESCE(of.is_campaigns_enabled, false) as is_campaigns_enabled,
                   COALESCE(of.is_breaks_enabled, true) as is_breaks_enabled,
                   COALESCE(of.heartbeat_interval_seconds, 300) as heartbeat_interval_seconds,
                   COALESCE(of.afk_threshold_seconds, 300) as afk_threshold_seconds,
                   COALESCE(of.shift_grace_minutes, 5) as shift_grace_minutes
            FROM users u
            LEFT JOIN organizations o ON u.org_id = o.id
            LEFT JOIN org_features of ON of.org_id = o.id
            WHERE u.email = $1
        `, [email]);
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

        // Update last login and heartbeat status (only when using new schema)
        if (user.password_hash != null) {
            try {
                await query(
                    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, force_logout = false WHERE id = $1',
                    [user.id]
                );
            } catch (_) { /* column may not exist in legacy schema */ }
        }

        const token = jwt.sign(
            { id: user.id, org_id: user.org_id, role: user.role, team_id: user.team_id || null },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Desktop agent login must not show CRM online until user starts a shift
        if (req.body.device_id) {
            await markUserShiftOffline(user.id, user.org_id);
        }

        const userName = user.full_name ?? user.name;
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                name: userName, 
                email: user.email, 
                role: user.role, 
                org_id: user.org_id, 
                org_name: user.org_name,
                team_id: user.team_id || null, 
                timezone: user.timezone, 
                org_timezone: user.org_timezone, 
                org_primary_color_light: user.org_primary_color_light, 
                org_primary_color_dark: user.org_primary_color_dark,
                features: {
                    is_campaigns_enabled: user.is_campaigns_enabled,
                    is_breaks_enabled: user.is_breaks_enabled,
                    heartbeat_interval_seconds: user.heartbeat_interval_seconds,
                    afk_threshold_seconds: user.afk_threshold_seconds,
                    shift_grace_minutes: user.shift_grace_minutes,
                }
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Request a password reset token
export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await query('SELECT id FROM users WHERE email = $1', [email]);

        // Always return success to prevent email enumeration
        if (result.rows.length === 0) {
            return res.json({ message: 'If that email exists, a reset link has been generated.' });
        }

        const userId = result.rows[0].id;
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await query(
            'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
            [hashedToken, expires, userId]
        );

        // In production, send an email with the reset link
        // For now, return the token directly (development only)
        console.log(`[Password Reset] Token for ${email}: ${resetToken}`);

        res.json({
            message: 'If that email exists, a reset link has been generated.',
            // Remove in production - only for development
            resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined
        });
    } catch (error) {
        console.error('requestPasswordReset error:', error);
        res.status(500).json({ error: 'Failed to process reset request' });
    }
};

// Reset password using token
export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const result = await query(
            'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
            [hashedToken]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const userId = result.rows[0].id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await query(
            'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
            [hashedPassword, userId]
        );

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('resetPassword error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// Change password (authenticated user)
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.user.id]);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('changePassword error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

export const getMe = async (req, res) => {
    try {
        const result = await query(
            `SELECT u.id, u.full_name as name, u.email, u.role, u.org_id, u.team_id, u.timezone, 
                    o.name as org_name, o.timezone as org_timezone, 
                    o.primary_color_light as org_primary_color_light, 
                    o.primary_color_dark as org_primary_color_dark,
                    COALESCE(of.is_campaigns_enabled, false) as is_campaigns_enabled,
                    COALESCE(of.is_breaks_enabled, true) as is_breaks_enabled
             FROM users u 
             JOIN organizations o ON u.org_id = o.id 
             LEFT JOIN org_features of ON of.org_id = o.id
             WHERE u.id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const userData = result.rows[0];

        // Agent token refresh / auto-login — clear stale online without requiring shift-offline route
        if (req.query.client === 'agent') {
            await markUserShiftOffline(userData.id, userData.org_id);
        }
        const response = {
            ...userData,
            features: {
                is_campaigns_enabled: userData.is_campaigns_enabled,
                is_breaks_enabled: userData.is_breaks_enabled
            }
        };
        delete response.is_campaigns_enabled;
        delete response.is_breaks_enabled;
        
        res.json(response);
    } catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};

export const getSSOStatus = async (req, res) => {
    try {
        const result = await query("SELECT setting_key, setting_value FROM global_settings WHERE setting_key IN ('sso_google_enabled', 'sso_microsoft_enabled', 'sso_apple_enabled')");
        const status = {
            google: false,
            microsoft: false,
            apple: false
        };
        for (const row of result.rows) {
            if (row.setting_key === 'sso_google_enabled') status.google = row.setting_value === true;
            if (row.setting_key === 'sso_microsoft_enabled') status.microsoft = row.setting_value === true;
            if (row.setting_key === 'sso_apple_enabled') status.apple = row.setting_value === true;
        }
        res.json(status);
    } catch (error) {
        console.error('getSSOStatus error:', error);
        res.status(500).json({ error: 'Failed to fetch SSO status' });
    }
};

export const verifySSO = async (req, res) => {
    const { provider, credential } = req.body; // 'google', 'microsoft', or 'apple'

    if (!provider || !credential) {
        return res.status(400).json({ error: 'Provider and credential are required' });
    }

    try {
        // First check if the provider is globally enabled
        const settingKey = `sso_${provider}_enabled`;
        const settingResult = await query("SELECT setting_value FROM global_settings WHERE setting_key = $1", [settingKey]);
        if (settingResult.rows.length === 0 || settingResult.rows[0].setting_value !== true) {
            return res.status(403).json({ error: `SSO login with ${provider} is disabled by the administrator` });
        }

        let email = null;
        let ssoId = null;

        if (provider === 'google') {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.VITE_GOOGLE_CLIENT_ID, // Ensure env var matches frontend
            });
            const payload = ticket.getPayload();
            email = payload.email;
            ssoId = payload.sub;

            if (!payload.email_verified) {
                return res.status(401).json({ error: 'Google email is not verified' });
            }
        } else if (provider === 'microsoft' || provider === 'apple') {
            // For Microsoft and Apple, decoding the JWT can provide the email, 
            // but strict verification requires calling their respective JWKS endpoints.
            // Placeholder for MS/Apple specific verification.
            return res.status(501).json({ error: `${provider} SSO verification not fully implemented yet on backend.` });
        } else {
            return res.status(400).json({ error: 'Unsupported provider' });
        }

        if (!email) {
            return res.status(400).json({ error: 'Could not extract email from SSO provider' });
        }

        // Login user if they exist
        const result = await query(`
            SELECT u.*, o.name as org_name, o.primary_color_light as org_primary_color_light, o.primary_color_dark as org_primary_color_dark, o.timezone as org_timezone,
                   COALESCE(of.is_campaigns_enabled, false) as is_campaigns_enabled,
                   COALESCE(of.is_breaks_enabled, true) as is_breaks_enabled
            FROM users u
            LEFT JOIN organizations o ON u.org_id = o.id
            LEFT JOIN org_features of ON of.org_id = o.id
            WHERE u.email = $1
        `, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found for this email. Contact your organization administrator.' });
        }

        const user = result.rows[0];

        const isActive = user.is_active !== undefined ? user.is_active : user.status !== 'suspended';
        if (!isActive) {
            return res.status(403).json({ error: 'Account suspended' });
        }

        if (user.password_hash != null) {
            try {
                await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
            } catch (_) { }
        }

        const token = jwt.sign(
            { id: user.id, org_id: user.org_id, role: user.role, team_id: user.team_id || null },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        const userName = user.full_name ?? user.name;
        res.json({ token, user: { id: user.id, name: userName, email: user.email, role: user.role, org_id: user.org_id, org_name: user.org_name, team_id: user.team_id || null, timezone: user.timezone, org_timezone: user.org_timezone, org_primary_color_light: user.org_primary_color_light, org_primary_color_dark: user.org_primary_color_dark, features: { is_campaigns_enabled: user.is_campaigns_enabled, is_breaks_enabled: user.is_breaks_enabled } } });

    } catch (error) {
        console.error('verifySSO error:', error);
        res.status(500).json({ error: 'SSO verification failed' });
    }
};
