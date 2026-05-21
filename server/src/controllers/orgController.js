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
                    heartbeat_interval_seconds = COALESCE($8, heartbeat_interval_seconds),
                    idle_action = COALESCE($9, idle_action),
                    idle_action_duration_minutes = COALESCE($10, idle_action_duration_minutes),
                    break_exceeded_action = COALESCE($11, break_exceeded_action),
                    shift_grace_minutes = COALESCE($12, shift_grace_minutes),
                    shift_absence_minutes = COALESCE($13, shift_absence_minutes),
                    shift_absence_action = COALESCE($14, shift_absence_action),
                    updated_at = CURRENT_TIMESTAMP
                WHERE org_id = $15
                RETURNING *`,
                [
                    features.is_activity_tracking_enabled,
                    features.is_screenshots_enabled,
                    features.screenshot_interval_seconds,
                    features.is_afk_tracking_enabled,
                    features.afk_threshold_seconds,
                    features.is_breaks_enabled,
                    features.is_force_logout_enabled,
                    features.heartbeat_interval_seconds,
                    features.idle_action,
                    features.idle_action_duration_minutes,
                    features.break_exceeded_action,
                    features.shift_grace_minutes,
                    features.shift_absence_minutes,
                    features.shift_absence_action,
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
                        is_force_logout_enabled,
                        heartbeat_interval_seconds,
                        idle_action,
                        idle_action_duration_minutes,
                        break_exceeded_action,
                        shift_grace_minutes,
                        shift_absence_minutes,
                        shift_absence_action
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                    [
                        orgId,
                        features.is_activity_tracking_enabled ?? true,
                        features.is_screenshots_enabled ?? true,
                        features.screenshot_interval_seconds ?? 300,
                        features.is_afk_tracking_enabled ?? true,
                        features.afk_threshold_seconds ?? 300,
                        features.is_breaks_enabled ?? true,
                        features.is_force_logout_enabled ?? true,
                        features.heartbeat_interval_seconds ?? 300,
                        features.idle_action ?? 'none',
                        features.idle_action_duration_minutes ?? 60,
                        features.break_exceeded_action ?? 'notification',
                        features.shift_grace_minutes ?? 5,
                        features.shift_absence_minutes ?? 120,
                        features.shift_absence_action ?? 'logout'
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
