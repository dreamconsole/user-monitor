import { query } from '../db.js';

// Get all organizations with some additional stats
export const getOrgs = async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                o.id, 
                o.name, 
                o.domain, 
                o.max_users_limit, 
                o.is_active, 
                o.created_at,
                (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) as current_users
            FROM organizations o
            ORDER BY o.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('getOrgs error:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
};

// Update an organization (subscription limit, active status etc)
export const updateOrg = async (req, res) => {
    const { id } = req.params;
    const { max_users_limit, is_active } = req.body;

    try {
        const result = await query(`
            UPDATE organizations 
            SET max_users_limit = COALESCE($1, max_users_limit),
                is_active = COALESCE($2, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, name, max_users_limit, is_active
        `, [max_users_limit, is_active, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateOrg error:', error);
        res.status(500).json({ error: 'Failed to update organization' });
    }
};

// Delete an organization - Soft Delete recommended
export const deleteOrg = async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete by setting is_active = false initially.
        // If a hard delete is required, it must cascade properly to users, sessions, etc.
        const result = await query(`
            UPDATE organizations 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING id
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Org not found' });
        res.json({ message: 'Organization deactivated successfully' });
    } catch (error) {
        console.error('deleteOrg error:', error);
        res.status(500).json({ error: 'Failed to deactivate organization' });
    }
};

// Get all global settings
export const getSettings = async (req, res) => {
    try {
        const result = await query('SELECT setting_key, setting_value, description FROM global_settings ORDER BY setting_key ASC');
        // Convert to key-value map for frontend
        const settingsMap = {};
        for (const row of result.rows) {
            settingsMap[row.setting_key] = {
                value: row.setting_value,
                description: row.description
            };
        }
        res.json(settingsMap);
    } catch (error) {
        console.error('getSettings error:', error);
        res.status(500).json({ error: 'Failed to fetch global settings' });
    }
};

// Update a specific global setting
export const updateSettings = async (req, res) => {
    const { settings } = req.body; // Expecting an array [{ key: 'sso_google_enabled', value: true }]

    if (!Array.isArray(settings)) {
        return res.status(400).json({ error: 'Request body must contain a "settings" array.' });
    }

    try {
        await query('BEGIN');

        for (const setting of settings) {
            if (!setting.key || setting.value === undefined) continue;

            await query(`
                INSERT INTO global_settings (setting_key, setting_value) 
                VALUES ($1, $2::jsonb)
                ON CONFLICT (setting_key) 
                DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
            `, [setting.key, JSON.stringify(setting.value)]);
        }

        await query('COMMIT');
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        await query('ROLLBACK');
        console.error('updateSettings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

// Get System Health (high level aggregations)
export const getSystemHealth = async (req, res) => {
    try {
        const orgsCount = await query('SELECT COUNT(*) FROM organizations');
        const activeUsers = await query("SELECT COUNT(*) FROM users WHERE is_active = true");
        const activeAgents = await query("SELECT COUNT(*) FROM agent_sessions WHERE token_expires_at > CURRENT_TIMESTAMP");

        res.json({
            uptime: process.uptime(),
            total_orgs: parseInt(orgsCount.rows[0].count),
            active_users: parseInt(activeUsers.rows[0].count),
            active_agent_sessions: parseInt(activeAgents.rows[0].count),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('getSystemHealth error:', error);
        res.status(500).json({ error: 'Failed to get system health metrics' });
    }
};
