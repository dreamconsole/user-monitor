import { query } from '../db.js';

export const getOrgSettings = async (req, res) => {
    try {
        const orgId = req.user.org_id;

        // Get org details and features including shift settings
        const orgResult = await query(
            `SELECT 
                name, max_users_limit, timezone,
                shift_start_time, shift_end_time, shift_duration, org_working_hours, work_days, start_of_day,
                primary_color_light, primary_color_dark
            FROM organizations WHERE id = $1`,
            [orgId]
        );

        const featuresResult = await query(
            'SELECT * FROM org_features WHERE org_id = $1',
            [orgId]
        );

        if (orgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const settings = {
            ...orgResult.rows[0],
            features: featuresResult.rows[0] || {}
        };

        res.json(settings);
    } catch (error) {
        console.error('getOrgSettings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

export const updateOrgSettings = async (req, res) => {
    const {
        features, timezone,
        shift_start_time, shift_end_time, shift_duration, org_working_hours, work_days, start_of_day,
        primary_color_light, primary_color_dark
    } = req.body;
    const orgId = req.user.org_id;

    try {
        // Update Organization settings
        await query(
            `UPDATE organizations SET 
                timezone = COALESCE($1, timezone),
                shift_start_time = COALESCE($2, shift_start_time),
                shift_end_time = COALESCE($3, shift_end_time),
                shift_duration = COALESCE($4, shift_duration),
                org_working_hours = COALESCE($5, org_working_hours),
                work_days = COALESCE($6, work_days),
                start_of_day = COALESCE($7, start_of_day),
                primary_color_light = COALESCE($8, primary_color_light),
                primary_color_dark = COALESCE($9, primary_color_dark),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $10`,
            [
                timezone,
                shift_start_time,
                shift_end_time,
                shift_duration,
                org_working_hours,
                work_days,
                start_of_day,
                primary_color_light,
                primary_color_dark,
                orgId
            ]
        );

        // Update org_features if provided
        if (features) {
            const result = await query(
                `UPDATE org_features SET 
                    is_activity_tracking_enabled = COALESCE($1, is_activity_tracking_enabled),
                    is_screenshots_enabled = COALESCE($2, is_screenshots_enabled),
                    screenshot_interval_seconds = COALESCE($3, screenshot_interval_seconds),
                    is_afk_tracking_enabled = COALESCE($4, is_afk_tracking_enabled),
                    afk_threshold_seconds = COALESCE($5, afk_threshold_seconds),
                    is_breaks_enabled = COALESCE($6, is_breaks_enabled),
                    is_force_logout_enabled = COALESCE($7, is_force_logout_enabled),
                    updated_at = CURRENT_TIMESTAMP
                WHERE org_id = $8
                RETURNING *`,
                [
                    features.is_activity_tracking_enabled,
                    features.is_screenshots_enabled,
                    features.screenshot_interval_seconds,
                    features.is_afk_tracking_enabled,
                    features.afk_threshold_seconds,
                    features.is_breaks_enabled,
                    features.is_force_logout_enabled,
                    orgId
                ]
            );

            if (result.rows.length === 0) {
                await query(
                    `INSERT INTO org_features (
                        org_id, 
                        is_activity_tracking_enabled,
                        is_screenshots_enabled,
                        screenshot_interval_seconds,
                        is_afk_tracking_enabled,
                        afk_threshold_seconds,
                        is_breaks_enabled,
                        is_force_logout_enabled
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        orgId,
                        features.is_activity_tracking_enabled ?? true,
                        features.is_screenshots_enabled ?? true,
                        features.screenshot_interval_seconds ?? 300,
                        features.is_afk_tracking_enabled ?? true,
                        features.afk_threshold_seconds ?? 300,
                        features.is_breaks_enabled ?? true,
                        features.is_force_logout_enabled ?? true
                    ]
                );
            }
        }

        // Return updated settings
        const orgResult = await query(
            `SELECT 
                name, max_users_limit, timezone,
                shift_start_time, shift_end_time, shift_duration, org_working_hours, work_days, start_of_day,
                primary_color_light, primary_color_dark
            FROM organizations WHERE id = $1`,
            [orgId]
        );

        const featuresResult = await query(
            'SELECT * FROM org_features WHERE org_id = $1',
            [orgId]
        );

        res.json({
            ...orgResult.rows[0],
            features: featuresResult.rows[0]
        });

    } catch (error) {
        console.error('updateOrgSettings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
