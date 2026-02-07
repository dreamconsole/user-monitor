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

        // Get org defaults
        const orgFeaturesResult = await query(
            'SELECT * FROM org_features WHERE org_id = $1',
            [orgId]
        );

        res.json({
            overrides: userFeaturesResult.rows[0] || null,
            defaults: orgFeaturesResult.rows[0] || {}
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
