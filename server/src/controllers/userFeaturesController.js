import { query } from '../db.js';

export const getUserFeatures = async (req, res) => {
    const { id: userId } = req.params;
    const orgId = req.user.org_id;

    try {
        // Get user overrides
        const userFeaturesResult = await query(
            'SELECT * FROM user_features WHERE user_id = $1 AND org_id = $2',
            [userId, orgId]
        );

        // Get org defaults (features + shift settings)
        const orgResult = await query(
            `SELECT 
                of.*,
                o.shift_start_time, o.shift_end_time, o.shift_duration, o.work_days
            FROM org_features of
            JOIN organizations o ON o.id = of.org_id
            WHERE of.org_id = $1`,
            [orgId]
        );

        // If org_features is missing for some reason, try fetching just org
        let defaults = orgResult.rows[0] || {};
        if (!orgResult.rows.length) {
            const orgOnly = await query('SELECT shift_start_time, shift_end_time, shift_duration, work_days FROM organizations WHERE id = $1', [orgId]);
            defaults = { ...defaults, ...orgOnly.rows[0] };
        }

        res.json({
            overrides: userFeaturesResult.rows[0] || null,
            defaults: defaults
        });
    } catch (error) {
        console.error('getUserFeatures error:', error);
        res.status(500).json({ error: 'Failed to fetch user features: ' + error.message });
    }
};

export const updateUserFeatures = async (req, res) => {
    const { id: userId } = req.params;
    const orgId = req.user.org_id;
    const { features } = req.body;

    if (!features) {
        return res.status(400).json({ error: 'Missing features data' });
    }

    try {
        // PERMISSION CHECK: If Manager, ensure they own this user
        if (req.user.role === 'manager') {
            const userCheck = await query('SELECT manager_id FROM users WHERE id = $1 AND org_id = $2', [userId, orgId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (userCheck.rows[0].manager_id !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized: You can only manage features for your direct reports.' });
            }
        }

        // Use UPSERT (INSERT ... ON CONFLICT)
        const result = await query(
            `INSERT INTO user_features (
                user_id, 
                org_id, 
                is_screenshots_enabled, 
                screenshot_interval_seconds,
                is_afk_tracking_enabled, 
                afk_threshold_seconds,
                is_breaks_enabled,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                is_screenshots_enabled = EXCLUDED.is_screenshots_enabled,
                screenshot_interval_seconds = EXCLUDED.screenshot_interval_seconds,
                is_afk_tracking_enabled = EXCLUDED.is_afk_tracking_enabled,
                afk_threshold_seconds = EXCLUDED.afk_threshold_seconds,
                is_breaks_enabled = EXCLUDED.is_breaks_enabled,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                userId,
                orgId,
                features.is_screenshots_enabled,
                features.screenshot_interval_seconds,
                features.is_afk_tracking_enabled,
                features.afk_threshold_seconds,
                features.is_breaks_enabled
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateUserFeatures error:', error);
        res.status(500).json({ error: 'Failed to update user features: ' + error.message });
    }
};
