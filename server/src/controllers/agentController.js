import { query } from '../db.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { broadcastToManagers } from '../websocket.js';

/** After org max shift hours from today's first check-in, force logout if idle this long (seconds). Applies during break. */
const SHIFT_CAP_POST_MAX_IDLE_SEC = 30 * 60;

/**
 * When breaks are disabled: after shift timer paused (grace expired), if still idle past shift_absence_minutes → logout or notify admin.
 */
async function evaluateShiftAbsencePolicy(orgId, userId, orgFeatures, body) {
    if (orgFeatures.is_breaks_enabled ?? true) return null;

    if (!body.shift_timer_paused) return null;

    const pausedSec = Number(body.shift_paused_seconds);
    if (!Number.isFinite(pausedSec) || pausedSec < 0) return null;

    const absenceMins = parseInt(orgFeatures.shift_absence_minutes, 10) || 120;
    if (pausedSec < absenceMins * 60) return null;

    const idleSec = Number(body.shift_cap_idle_seconds ?? body.current_idle_time ?? 0);
    const afkThreshold = parseInt(orgFeatures.afk_threshold_seconds, 10) || 300;
    if (!Number.isFinite(idleSec) || idleSec < afkThreshold) return null;

    const action = orgFeatures.shift_absence_action || 'logout';

    if (action === 'notify_admin') {
        const managerId = (await query('SELECT manager_id FROM users WHERE id = $1', [userId])).rows[0]?.manager_id;
        if (managerId) {
            const recentNotif = await query(
                `SELECT id FROM notifications WHERE recipient_id = $1 AND actor_id = $2 AND type = 'SHIFT_ABSENCE' AND created_at > NOW() - INTERVAL '2 hours'`,
                [managerId, userId]
            );
            if (recentNotif.rows.length === 0) {
                const uName = (await query('SELECT full_name FROM users WHERE id = $1', [userId])).rows[0]?.full_name || 'User';
                const pausedMins = Math.floor(pausedSec / 60);
                await query(
                    `INSERT INTO notifications (org_id, recipient_id, actor_id, type, title, message)
                     VALUES ($1, $2, $3, 'SHIFT_ABSENCE', $4, $5)`,
                    [orgId, managerId, userId, 'Shift Absence Alert',
                        `${uName} has been away from the desk for ${pausedMins} minutes (shift timer paused).`]
                );
            }
        }
        return 'FORCE_LOGOUT';
    }

    return 'FORCE_LOGOUT';
}

async function setForceLogoutFlag(userId) {
    await query('UPDATE users SET force_logout = true WHERE id = $1', [userId]);
}

/**
 * Daily break usage over max_duration_seconds for a break type, then idle this long → force logout (when org break_exceeded_action is logout).
 */
async function evaluateBreakExceededIdleForceLogout(orgId, userId, idleSecondsRaw) {
    if (idleSecondsRaw === undefined || idleSecondsRaw === null) return null;
    const idleSeconds = Number(idleSecondsRaw);
    if (!Number.isFinite(idleSeconds) || idleSeconds < SHIFT_CAP_POST_MAX_IDLE_SEC) return null;

    const orgFeat = await query(
        'SELECT break_exceeded_action FROM org_features WHERE org_id = $1',
        [orgId]
    );
    const breakAction = orgFeat.rows[0]?.break_exceeded_action || 'notification';
    if (breakAction !== 'logout') return null;

    const orgTzRes = await query(
        'SELECT COALESCE(timezone, \'UTC\') AS tz FROM organizations WHERE id = $1',
        [orgId]
    );
    const orgTz = orgTzRes.rows[0]?.tz || 'UTC';

    const typesRes = await query(
        `SELECT id, max_duration_seconds FROM break_master
         WHERE org_id = $1 AND is_active = true AND max_duration_seconds IS NOT NULL`,
        [orgId]
    );

    for (const bt of typesRes.rows) {
        const usageRes = await query(
            `SELECT COALESCE(SUM(
                CASE
                    WHEN duration_seconds IS NOT NULL THEN duration_seconds
                    WHEN end_time IS NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
                    ELSE 0
                END
            ), 0) AS total_used
             FROM break_logs
             WHERE user_id = $1
               AND break_type_id = $2
               AND org_id = $3
               AND (start_time AT TIME ZONE $4)::date = (CURRENT_TIMESTAMP AT TIME ZONE $4)::date`,
            [userId, bt.id, orgId, orgTz]
        );
        const totalUsed = parseInt(usageRes.rows[0]?.total_used || 0, 10);
        if (totalUsed > bt.max_duration_seconds) {
            return 'FORCE_LOGOUT';
        }
    }
    return null;
}

/**
 * Uses first heartbeat today (org TZ), else first work_session start today, else now.
 * When past anchor + shift_duration hours and idleSeconds >= SHIFT_CAP_POST_MAX_IDLE_SEC, returns FORCE_LOGOUT.
 */
async function evaluateShiftDurationForceLogout(orgId, userId, state, statusField, idleSecondsRaw) {
    if (idleSecondsRaw === undefined || idleSecondsRaw === null) return null;
    const idleSeconds = Number(idleSecondsRaw);
    if (!Number.isFinite(idleSeconds) || idleSeconds < SHIFT_CAP_POST_MAX_IDLE_SEC) return null;

    const stateNorm = (state || statusField || '').toString().trim().toUpperCase();
    if (stateNorm === 'OFFLINE') return null;

    const meta = await query(
        `SELECT o.timezone, o.shift_duration AS org_sd, u.shift_duration AS user_sd
         FROM users u
         JOIN organizations o ON o.id = u.org_id
         WHERE u.id = $1 AND u.org_id = $2`,
        [userId, orgId]
    );
    if (!meta.rows[0]) return null;
    const tz = meta.rows[0].timezone || 'UTC';
    const capHours = parseFloat(meta.rows[0].user_sd ?? meta.rows[0].org_sd);
    if (!Number.isFinite(capHours) || capHours <= 0) return null;

    const anchorRes = await query(
        `SELECT COALESCE(
            (SELECT MIN(h.last_seen_at) FROM heartbeats h
             WHERE h.user_id = $1 AND h.org_id = $2
               AND (h.last_seen_at AT TIME ZONE $3)::date = (CURRENT_TIMESTAMP AT TIME ZONE $3)::date),
            (SELECT MIN(ws.start_time) FROM work_sessions ws
             WHERE ws.user_id = $1 AND ws.org_id = $2
               AND ws.work_date = (CURRENT_TIMESTAMP AT TIME ZONE $3)::date),
            CURRENT_TIMESTAMP
        ) AS anchor`,
        [userId, orgId, tz]
    );
    const anchor = anchorRes.rows[0]?.anchor;
    if (!anchor) return null;
    const anchorMs = new Date(anchor).getTime();
    if (!Number.isFinite(anchorMs)) return null;
    const deadlineMs = anchorMs + capHours * 3600 * 1000;
    if (Date.now() <= deadlineMs) return null;
    return 'FORCE_LOGOUT';
}

export const getAssignedCampaigns = async (req, res) => {
    try {
        const { org_id, id: user_id } = req.user;

        // Check feature flag
        const featureRes = await query('SELECT is_campaigns_enabled FROM org_features WHERE org_id = $1', [org_id]);
        if (featureRes.rows.length === 0 || !featureRes.rows[0].is_campaigns_enabled) {
            return res.status(200).json({ success: true, campaigns: [] });
        }

        const result = await query(`
            SELECT DISTINCT c.id, c.name 
            FROM campaigns c 
            JOIN campaign_assignments ca ON c.id = ca.campaign_id 
            LEFT JOIN users u ON ca.user_id = u.id OR ca.team_id = u.team_id
            WHERE c.org_id = $1 AND c.is_active = true AND u.id = $2
        `, [org_id, user_id]);
        
        res.status(200).json({ success: true, campaigns: result.rows });
    } catch (error) {
        console.error('Error fetching user campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to construct campaigns' });
    }
};

export const logHeartbeat = async (req, res) => {
    const { org_id, user_id, device_identifier } = req.body;
    try {
        // Validate user and org existence first
        // Validate user and org existence first
        const userCheck = await query('SELECT id, force_logout, is_active FROM users WHERE id = $1 AND org_id = $2', [user_id, org_id]);
        if (userCheck.rows.length === 0) {
            console.warn(`[logHeartbeat] Invalid Org/User: Org=${org_id}, User=${user_id}. Requesting Agent Logout.`);
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user session'
            });
        }

        const user = userCheck.rows[0];

        if (user.force_logout || !user.is_active) {
            console.warn(`[logHeartbeat] Forced Logout (Flag: ${user.force_logout}, Active: ${user.is_active}) for User ${user_id}`);
            // Reset the flag if it was force_logout (active check doesn't need reset, just kicks out)
            if (user.force_logout) {
                await query('UPDATE users SET force_logout = false WHERE id = $1', [user_id]);
            }
            return res.status(200).json({ success: true, command: 'FORCE_LOGOUT' });
        }

        // Update last_heartbeat_at in agent_sessions or insert if not exists
        const { agent_version, device_name, state, current_idle_time, shift_cap_idle_seconds } = req.body;
        let { token } = req.body;

        // If token is missing in body, try to get it from context/headers
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.split(' ')[1];
        }

        const sessionUpdate = await query(
            'UPDATE agent_sessions SET last_heartbeat_at = CURRENT_TIMESTAMP, auth_token = COALESCE($1, auth_token) WHERE org_id = $2 AND user_id = $3 AND device_identifier = $4',
            [token || null, org_id, user_id, device_identifier]
        );

        if (sessionUpdate.rowCount === 0) {
            // Create a new agent session record if it doesn't exist
            console.log(`[logHeartbeat] Creating new agent_session for User: ${user_id}, Device: ${device_identifier}`);
            await query(
                'INSERT INTO agent_sessions (org_id, user_id, device_identifier, device_name, auth_token, token_expires_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL \'30 days\')',
                [org_id, user_id, device_identifier, device_name || 'Generic Device', token || 'no-token']
            ).catch(err => console.error('[logHeartbeat] Failed to create agent_session:', err.message));
        }

        // Record historical heartbeat
        // console.log(`[logHeartbeat] Recording for User: ${user_id}, Org: ${org_id}`);
        await query(
            'INSERT INTO heartbeats (org_id, user_id, device_id, status) VALUES ($1, $2, $3, $4)',
            [org_id, user_id, device_identifier, 'ONLINE']
        );

        // Update users table with latest tracking info
        await query(
            `UPDATE users SET 
                last_heartbeat = CURRENT_TIMESTAMP,
                device_id = $1,
                agent_version = COALESCE($2, agent_version),
                token = COALESCE($3, token),
                current_state = COALESCE($5, current_state)
            WHERE id = $4`,
            [device_identifier, agent_version || null, token || null, user_id, state || null]
        );

        // Fetch Features (Org Defaults)
        const orgFeaturesRes = await query('SELECT * FROM org_features WHERE org_id = $1', [org_id]);
        const orgFeatures = orgFeaturesRes.rows[0] || {};

        // Fetch User Overrides
        const userFeaturesRes = await query('SELECT * FROM user_features WHERE user_id = $1', [user_id]);
        const userFeatures = userFeaturesRes.rows[0] || {};

        // Merge Features: User > Org > Defaults
        // If user setting is NULL, fall back to Org. If Org is missing, use code defaults (handled by Agent, but good to send explicit nulls/values)
        const breaksEnabled = userFeatures.is_breaks_enabled ?? orgFeatures.is_breaks_enabled ?? true;

        const features = {
            is_activity_tracking_enabled: userFeatures.is_activity_tracking_enabled ?? orgFeatures.is_activity_tracking_enabled ?? true,
            is_screenshots_enabled: userFeatures.is_screenshots_enabled ?? orgFeatures.is_screenshots_enabled ?? true,
            screenshot_interval_seconds: userFeatures.screenshot_interval_seconds || orgFeatures.screenshot_interval_seconds || 600,
            is_afk_tracking_enabled: userFeatures.is_afk_tracking_enabled ?? orgFeatures.is_afk_tracking_enabled ?? true,
            afk_threshold_seconds: userFeatures.afk_threshold_seconds || orgFeatures.afk_threshold_seconds || 300,
            is_breaks_enabled: breaksEnabled,
            shift_grace_minutes: orgFeatures.shift_grace_minutes ?? 5,
            shift_absence_minutes: orgFeatures.shift_absence_minutes ?? 120,
            shift_absence_action: orgFeatures.shift_absence_action || 'logout',
            heartbeat_interval_seconds: userFeatures.heartbeat_interval_seconds || orgFeatures.heartbeat_interval_seconds || 300
        };

        // Shift absence policy (breaks disabled only)
        const absenceCmd = await evaluateShiftAbsencePolicy(org_id, user_id, orgFeatures, req.body);
        if (absenceCmd === 'FORCE_LOGOUT') {
            console.log(`[logHeartbeat] Shift absence policy; FORCE_LOGOUT user ${user_id}`);
            await setForceLogoutFlag(user_id);
            return res.status(200).json({ success: true, command: 'FORCE_LOGOUT', features });
        }

        // Check Idle Actions (when breaks enabled — avoid duplicate policy when breaks off)
        if (breaksEnabled && current_idle_time !== undefined && orgFeatures.idle_action && orgFeatures.idle_action !== 'none') {
            const idleMins = Math.floor(current_idle_time / 60);
            if (idleMins >= (orgFeatures.idle_action_duration_minutes || 60)) {
                if (orgFeatures.idle_action === 'logout') {
                    console.log(`[logHeartbeat] Triggering Auto-Logout for User ${user_id} due to inactivity (${idleMins} mins)`);
                    await setForceLogoutFlag(user_id);
                    return res.status(200).json({ success: true, command: 'FORCE_LOGOUT' });
                } else if (orgFeatures.idle_action === 'notification') {
                    const managerId = user.manager_id || (await query('SELECT manager_id FROM users WHERE id = $1', [user_id])).rows[0]?.manager_id;
                    if (managerId) {
                        const recentNotif = await query(
                            `SELECT id FROM notifications WHERE recipient_id = $1 AND actor_id = $2 AND type = 'IDLE_VIOLATION' AND created_at > NOW() - INTERVAL '1 hour'`,
                            [managerId, user_id]
                        );
                        if (recentNotif.rows.length === 0) {
                            const uName = (await query('SELECT full_name FROM users WHERE id = $1', [user_id])).rows[0]?.full_name || 'User';
                            await query(
                                `INSERT INTO notifications (org_id, recipient_id, actor_id, type, title, message)
                                 VALUES ($1, $2, $3, 'IDLE_VIOLATION', $4, $5)`,
                                [org_id, managerId, user_id, 'User Inactivity Detected', `${uName} has been idle for ${idleMins} minutes.`]
                            );
                        }
                    }
                }
            }
        }

        const idleForShiftCap = shift_cap_idle_seconds ?? current_idle_time;
        const shiftCapCmd = await evaluateShiftDurationForceLogout(org_id, user_id, state, req.body.status, idleForShiftCap);
        if (shiftCapCmd === 'FORCE_LOGOUT') {
            console.log(`[logHeartbeat] Max shift duration + idle >= ${SHIFT_CAP_POST_MAX_IDLE_SEC}s; FORCE_LOGOUT user ${user_id}`);
            await setForceLogoutFlag(user_id);
            return res.status(200).json({ success: true, command: 'FORCE_LOGOUT' });
        }

        const breakExceededCmd = breaksEnabled
            ? await evaluateBreakExceededIdleForceLogout(org_id, user_id, idleForShiftCap)
            : null;
        if (breakExceededCmd === 'FORCE_LOGOUT') {
            console.log(`[logHeartbeat] Break limit exceeded + idle >= ${SHIFT_CAP_POST_MAX_IDLE_SEC}s; FORCE_LOGOUT user ${user_id}`);
            await setForceLogoutFlag(user_id);
            return res.status(200).json({ success: true, command: 'FORCE_LOGOUT' });
        }

        // Broadcast heartbeat to managers for live dashboard updates
        try {
            broadcastToManagers(org_id, {
                type: 'USER_HEARTBEAT',
                userId: user_id,
                timestamp: new Date().toISOString()
            });
        } catch (_) { /* non-critical */ }

        res.status(200).json({
            success: true,
            features
        });
    } catch (error) {
        console.error('[logHeartbeat] CRITICAL ERROR:', error);
        res.status(500).json({ error: 'Failed to log heartbeat' });
    }
};

export const syncActivitySession = async (req, res) => {
    const { id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, status, campaign_id } = req.body;
    try {
        // Validate user and org existence
        const userCheck = await query('SELECT id FROM users WHERE id = $1 AND org_id = $2', [user_id, org_id]);
        if (userCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user session'
            });
        }
        // activity_sessions is now work_sessions
        // Calculate work_date based on start_time AT TIME ZONE org's timezone
        await query(
            `INSERT INTO work_sessions (id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, total_break_seconds, status, work_date, campaign_id)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, ($4::TIMESTAMPTZ AT TIME ZONE 
                COALESCE((SELECT timezone FROM organizations WHERE id = $2), 'UTC')
             )::DATE, $10
             ON CONFLICT (id) DO UPDATE SET
             end_time = EXCLUDED.end_time,
             total_work_seconds = EXCLUDED.total_work_seconds,
             total_idle_seconds = EXCLUDED.total_idle_seconds,
             total_break_seconds = EXCLUDED.total_break_seconds,
             status = EXCLUDED.status,
             work_date = EXCLUDED.work_date,
             campaign_id = EXCLUDED.campaign_id`,
            [id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, req.body.total_break_seconds || 0, status, campaign_id || null]
        );
        // Refresh heartbeat status
        await query('UPDATE users SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        try {
            broadcastToManagers(org_id, {
                type: 'USER_HEARTBEAT',
                userId: user_id,
                timestamp: new Date().toISOString()
            });
        } catch (_) { /* non-critical */ }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Work session sync failed:', error);
        if (error.code === '23503') {
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user ID in session'
            });
        }
        res.status(500).json({ success: false, error: 'Failed to sync work session' });
    }
};

export const uploadScreenshot = async (req, res) => {
    const { org_id, user_id, session_id, captured_at, metadata } = req.body;
    const screenshot = req.file;

    if (!screenshot) {
        return res.status(400).json({ error: 'No screenshot uploaded' });
    }

    try {
        const storagePath = screenshot.path.replace(/\\/g, '/');

        await query(
            'INSERT INTO screenshots (id, org_id, user_id, session_id, storage_path, captured_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [crypto.randomUUID(), org_id, user_id, session_id, storagePath, captured_at, metadata || {}]
        );
        // Refresh heartbeat status
        await query('UPDATE users SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        try {
            broadcastToManagers(org_id, {
                type: 'USER_HEARTBEAT',
                userId: user_id,
                timestamp: new Date().toISOString()
            });
        } catch (_) { /* non-critical */ }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Screenshot upload failed:', error);
        res.status(500).json({ error: 'Failed to upload screenshot' });
    }
};

export const logActivity = async (req, res) => {
    const { org_id, user_id, session_id, log_time, keyboard_events, mouse_events, left_clicks, right_clicks, state, metadata } = req.body;
    console.log('[logActivity] RECEIVED:', { org_id, user_id, session_id, log_time, keyboard_events, mouse_events, left_clicks, right_clicks, state });

    try {
        // Validate user and org existence
        const userCheck = await query('SELECT id FROM users WHERE id = $1 AND org_id = $2', [user_id, org_id]);
        if (userCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user session'
            });
        }
        const result = await query(
            `INSERT INTO activity_logs (org_id, user_id, session_id, log_time, keyboard_events, mouse_events, left_clicks, right_clicks, state, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [org_id, user_id, session_id, log_time, keyboard_events || 0, mouse_events || 0, left_clicks || 0, right_clicks || 0, state, metadata || null]
        );
        console.log('[logActivity] SUCCESS, inserted ID:', result.rows[0].id);
        // Refresh heartbeat status
        await query('UPDATE users SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        try {
            broadcastToManagers(org_id, {
                type: 'USER_HEARTBEAT',
                userId: user_id,
                timestamp: new Date().toISOString()
            });
        } catch (_) { /* non-critical */ }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[logActivity] CRITICAL ERROR:', error);
        if (error.code === '23503') {
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user ID in activity log'
            });
        }
        res.status(500).json({ success: false, error: 'Failed to log activity' });
    }
};

export const logBreak = async (req, res) => {
    const { id, org_id, user_id, session_id, break_type_id, start_time, end_time, duration_seconds } = req.body;

    try {
        // Validate user and org existence
        const userCheck = await query('SELECT id FROM users WHERE id = $1 AND org_id = $2', [user_id, org_id]);
        if (userCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user session'
            });
        }
        let finalBreakTypeId = break_type_id;

        // If break_type_id is not a UUID, try to find it by name
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (break_type_id && !UUID_REGEX.test(break_type_id)) {
            // Find a match where the break master name contains the string or vice versa
            const btResult = await query(
                `SELECT id FROM break_master 
                 WHERE org_id = $1 
                 AND (name ILIKE $2 || '%' OR $2 ILIKE name || '%')
                 LIMIT 1`,
                [org_id, break_type_id]
            );

            if (btResult.rows.length > 0) {
                finalBreakTypeId = btResult.rows[0].id;
            } else {
                // Last ditch effort: substring match
                const fuzzyResult = await query(
                    'SELECT id FROM break_master WHERE org_id = $1 AND (name ILIKE \'%\' || $2 || \'%\' OR $2 ILIKE \'%\' || name || \'%\') LIMIT 1',
                    [org_id, break_type_id]
                );
                finalBreakTypeId = fuzzyResult.rows.length > 0 ? fuzzyResult.rows[0].id : null;
            }
        }

        await query(
            `INSERT INTO break_logs (id, org_id, user_id, session_id, break_type_id, start_time, end_time, duration_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
             end_time = EXCLUDED.end_time,
             duration_seconds = EXCLUDED.duration_seconds`,
            [id, org_id, user_id, session_id, finalBreakTypeId, start_time, end_time || null, duration_seconds || 0]
        );
        if (finalBreakTypeId && (duration_seconds > 0 || end_time)) {
            // Check for violations asynchronously (fire and forget)
            checkAndNotifyBreakViolation(org_id, user_id, finalBreakTypeId)
                .catch(err => console.error('Break violation check failed:', err));
        }

        // Refresh heartbeat status
        await query('UPDATE users SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        try {
            broadcastToManagers(org_id, {
                type: 'USER_HEARTBEAT',
                userId: user_id,
                timestamp: new Date().toISOString()
            });
        } catch (_) { /* non-critical */ }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Break log failed:', error);
        if (error.code === '23503') {
            return res.status(403).json({
                success: false,
                command: 'FORCE_LOGOUT',
                error: 'Invalid organization or user ID in break log'
            });
        }
        res.status(500).json({ success: false, error: 'Failed to log break' });
    }
};

// Helper to check break balance and notify manager
export async function checkAndNotifyBreakViolation(orgId, userId, breakTypeId) {
    // 1. Get Break Definition & User Manager & Org ID
    const metadataRes = await query(
        `SELECT 
            bm.name as break_name, 
            bm.max_duration_seconds,
            u.full_name as user_name,
            u.team_id,
            u.org_id
         FROM break_master bm
         JOIN users u ON u.id = $1
         WHERE bm.id = $2`,
        [userId, breakTypeId]
    );

    if (metadataRes.rows.length === 0) return;
    const { break_name, max_duration_seconds, user_name, team_id, org_id: userOrgId } = metadataRes.rows[0];

    // If no limit or no team, nothing to do
    if (!max_duration_seconds || !team_id) return;

    // Use passed orgId or fall back to user's org_id
    const finalOrgId = orgId || userOrgId;

    const orgTzRes = await query(
        'SELECT COALESCE(timezone, \'UTC\') AS tz FROM organizations WHERE id = $1',
        [finalOrgId]
    );
    const orgTz = orgTzRes.rows[0]?.tz || 'UTC';

    // 2. Calculate Total Usage for Today (org-local calendar day)
    const usageRes = await query(
        `SELECT SUM(
            CASE 
                WHEN duration_seconds IS NOT NULL THEN duration_seconds
                WHEN end_time IS NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
                ELSE 0 
            END
         ) as total_used
         FROM break_logs 
         WHERE user_id = $1 
           AND break_type_id = $2
           AND org_id = $4
           AND (start_time AT TIME ZONE $3)::date = (CURRENT_TIMESTAMP AT TIME ZONE $3)::date`,
        [userId, breakTypeId, orgTz, finalOrgId]
    );

    const totalUsed = parseInt(usageRes.rows[0].total_used || 0);

    // 3. Check Violation
    if (totalUsed > max_duration_seconds) {
        const excess = totalUsed - max_duration_seconds;
        const excessMinutes = Math.ceil(excess / 60);

        const orgFeaturesRes = await query('SELECT break_exceeded_action FROM org_features WHERE org_id = $1', [finalOrgId]);
        const breakAction = orgFeaturesRes.rows[0]?.break_exceeded_action || 'notification';

        if (breakAction === 'logout') {
            // force_logout is set from logHeartbeat after daily break limit is exceeded AND user is idle
            // SHIFT_CAP_POST_MAX_IDLE_SEC (see evaluateBreakExceededIdleForceLogout), so CRM flag stays in sync with agent kick.
            console.log(`[BreakViolation] User ${userId} exceeded ${break_name} limit; logout will apply after idle threshold on next heartbeats`);
        } else if (breakAction === 'notification') {
            // Find managers of the team
            const managersRes = await query(
                'SELECT id FROM users WHERE team_id = $1 AND role = \'manager\' AND org_id = $2',
                [team_id, finalOrgId]
            );

            for (const managerRow of managersRes.rows) {
                const manager_id = managerRow.id;
                // 4. Check if already notified TODAY for this break type
                const existingNotif = await query(
                    `SELECT id FROM notifications 
                     WHERE recipient_id = $1 
                       AND actor_id = $2 
                       AND type = 'BREAK_VIOLATION'
                       AND title LIKE $3
                       AND (created_at AT TIME ZONE $4)::date = (CURRENT_TIMESTAMP AT TIME ZONE $4)::date`,
                    [manager_id, userId, `%${break_name}%`, orgTz]
                );

                if (existingNotif.rows.length === 0) {
                    // 5. Insert Notification
                    await query(
                        `INSERT INTO notifications (org_id, recipient_id, actor_id, type, title, message)
                         VALUES ($1, $2, $3, 'BREAK_VIOLATION', $4, $5)`,
                        [
                            finalOrgId,
                            manager_id,
                            userId,
                            `Break Limit Exceeded: ${break_name}`,
                            `${user_name} has exceeded the ${break_name} limit by ${excessMinutes} minutes.`
                        ]
                    );
                    console.log(`[Notification] Sent BREAK_VIOLATION for User ${userId} to Manager ${manager_id}`);
                }
            }
        }
    }
}

export const logBrowserActivity = async (req, res) => {
    const { logs } = req.body;
    const user_id = req.user.id;
    const org_id = req.user.org_id;

    if (!logs || !Array.isArray(logs) || logs.length === 0) {
        return res.status(400).json({ success: false, error: 'No activity logs provided' });
    }

    try {
        let inserted = 0;
        for (const log of logs) {
            await query(
                `INSERT INTO browser_activity_logs (org_id, user_id, browser, domain, title, start_time, end_time, duration_seconds, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    org_id,
                    user_id,
                    log.browser || 'unknown',
                    log.domain || null,
                    (log.title || '').substring(0, 500),
                    log.start_time,
                    log.end_time,
                    log.duration_seconds || 0,
                    log.source || 'extension'
                ]
            );
            inserted++;
        }

        console.log(`[BrowserActivity] Synced ${inserted} logs for user ${user_id}`);
        // Refresh heartbeat status
        await query('UPDATE users SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        try {
            broadcastToManagers(org_id, {
                type: 'USER_HEARTBEAT',
                userId: user_id,
                timestamp: new Date().toISOString()
            });
        } catch (_) { /* non-critical */ }
        res.status(200).json({ success: true, inserted });
    } catch (error) {
        console.error('[BrowserActivity] Sync failed:', error);
        res.status(500).json({ success: false, error: 'Failed to log browser activity' });
    }
};

export const getBreaks = async (req, res) => {
    // For GET requests, parameters are in req.query, but we primarily use req.user from token
    const org_id = req.body?.org_id || req.query?.org_id;
    // Note: agent routes use authenticateToken which sets req.user. However, some agent endpoints 
    // might be called with just a token in the body/header. 
    // The middleware `authenticateToken` ensures `req.user` is set.

    // Fallback: use req.user.org_id from middleware if not in body/query
    const targetOrgId = org_id || req.user.org_id;

    try {
        const userId = req.user.id;

        // 1. Resolve User's Break Group
        // Priority: Team's Break Group -> Org Default Break Group
        const groupRes = await query(`
            SELECT 
                COALESCE(
                    (SELECT break_group_id FROM teams t JOIN users u ON u.team_id = t.id WHERE u.id = $1 LIMIT 1),
                    (SELECT id FROM break_groups WHERE org_id = $2 AND is_default = true LIMIT 1)
                ) as active_group_id
        `, [userId, targetOrgId]);

        const activeGroupId = groupRes.rows[0]?.active_group_id;

        // 2. Get active break types for this group
        let breaksQuery;
        let queryParams;

        if (activeGroupId) {
            breaksQuery = 'SELECT id, name, break_type, fixed_start_time, fixed_end_time, max_duration_seconds, daily_limit, is_paid FROM break_master WHERE org_id = $1 AND break_group_id = $2 AND is_active = true ORDER BY name ASC';
            queryParams = [targetOrgId, activeGroupId];
        } else {
            // Fallback if no groups are defined (legacy support)
            breaksQuery = 'SELECT id, name, break_type, fixed_start_time, fixed_end_time, max_duration_seconds, daily_limit, is_paid FROM break_master WHERE org_id = $1 AND break_group_id IS NULL AND is_active = true ORDER BY name ASC';
            queryParams = [targetOrgId];
        }

        const breaksResult = await query(breaksQuery, queryParams);

        // 3. Calculate used time and daily counts for the current day
        const usageResult = await query(
            `SELECT break_type_id, 
                    COUNT(*) as daily_uses,
                    SUM(
                        CASE 
                            WHEN duration_seconds IS NOT NULL THEN duration_seconds
                            WHEN end_time IS NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
                            ELSE 0 
                        END
                    ) as total_used_seconds
             FROM break_logs 
             WHERE user_id = $1 
               AND start_time::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE
             GROUP BY break_type_id`,
            [userId]
        );

        // Map usage to a lookup object
        const usageMap = {};
        usageResult.rows.forEach(row => {
            usageMap[row.break_type_id] = {
                used_seconds: Math.floor(parseFloat(row.total_used_seconds) || 0),
                daily_uses: parseInt(row.daily_uses) || 0
            };
        });

        // 4. Merge usage and evaluate limits
        const breaksWithUsage = breaksResult.rows.map(b => {
            const usage = usageMap[b.id] || { used_seconds: 0, daily_uses: 0 };

            return {
                ...b,
                used_seconds: usage.used_seconds,
                daily_uses: usage.daily_uses,
                remaining_seconds: b.max_duration_seconds ? Math.max(0, b.max_duration_seconds - usage.used_seconds) : null,
                is_limit_reached: (b.daily_limit && usage.daily_uses >= b.daily_limit) || false
            };
        });

        res.status(200).json({
            success: true,
            breaks: breaksWithUsage
        });
    } catch (error) {
        console.error('getBreaks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch breaks'
        });
    }
};
