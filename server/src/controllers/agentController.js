import { query } from '../db.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { broadcastToManagers } from '../websocket.js';

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
        const { agent_version, device_name } = req.body;
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
                token = COALESCE($3, token)
            WHERE id = $4`,
            [device_identifier, agent_version || null, token || null, user_id]
        );

        // Fetch Features (Org Defaults)
        const orgFeaturesRes = await query('SELECT * FROM org_features WHERE org_id = $1', [org_id]);
        const orgFeatures = orgFeaturesRes.rows[0] || {};

        // Fetch User Overrides
        const userFeaturesRes = await query('SELECT * FROM user_features WHERE user_id = $1', [user_id]);
        const userFeatures = userFeaturesRes.rows[0] || {};

        // Merge Features: User > Org > Defaults
        // If user setting is NULL, fall back to Org. If Org is missing, use code defaults (handled by Agent, but good to send explicit nulls/values)
        const features = {
            is_activity_tracking_enabled: userFeatures.is_activity_tracking_enabled ?? orgFeatures.is_activity_tracking_enabled ?? true,
            is_screenshots_enabled: userFeatures.is_screenshots_enabled ?? orgFeatures.is_screenshots_enabled ?? true,
            screenshot_interval_seconds: userFeatures.screenshot_interval_seconds || orgFeatures.screenshot_interval_seconds || 600,
            is_afk_tracking_enabled: userFeatures.is_afk_tracking_enabled ?? orgFeatures.is_afk_tracking_enabled ?? true,
            afk_threshold_seconds: userFeatures.afk_threshold_seconds || orgFeatures.afk_threshold_seconds || 300,
            is_breaks_enabled: userFeatures.is_breaks_enabled ?? orgFeatures.is_breaks_enabled ?? true
        };

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
    const { id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, status } = req.body;
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
        // Calculate work_date based on start_time AT TIME ZONE user's timezone
        // Use a CASE to handle the unrecognized 'Asia/Calcutta' alias often found in older systems
        await query(
            `INSERT INTO work_sessions (id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, total_break_seconds, status, work_date)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, ($4::TIMESTAMPTZ AT TIME ZONE 
                CASE 
                    WHEN u.timezone = 'Asia/Calcutta' THEN 'Asia/Kolkata'
                    WHEN u.timezone IS NULL THEN 'UTC'
                    ELSE u.timezone 
                END)::DATE
             FROM users u WHERE u.id = $3
             ON CONFLICT (id) DO UPDATE SET
             end_time = EXCLUDED.end_time,
             total_work_seconds = EXCLUDED.total_work_seconds,
             total_idle_seconds = EXCLUDED.total_idle_seconds,
             total_break_seconds = EXCLUDED.total_break_seconds,
             status = EXCLUDED.status,
             work_date = EXCLUDED.work_date`,
            [id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, req.body.total_break_seconds || 0, status]
        );
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
        const storagePath = screenshot.path;

        await query(
            'INSERT INTO screenshots (id, org_id, user_id, session_id, storage_path, captured_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [crypto.randomUUID(), org_id, user_id, session_id, storagePath, captured_at, metadata || {}]
        );
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Screenshot upload failed:', error);
        res.status(500).json({ error: 'Failed to upload screenshot' });
    }
};

export const logActivity = async (req, res) => {
    const { org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state, metadata } = req.body;
    console.log('[logActivity] RECEIVED:', { org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state });

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
            `INSERT INTO activity_logs (org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [org_id, user_id, session_id, log_time, keyboard_events || 0, mouse_events || 0, state, metadata || null]
        );
        console.log('[logActivity] SUCCESS, inserted ID:', result.rows[0].id);
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
            u.manager_id,
            u.org_id
         FROM break_master bm
         JOIN users u ON u.id = $1
         WHERE bm.id = $2`,
        [userId, breakTypeId]
    );

    if (metadataRes.rows.length === 0) return;
    const { break_name, max_duration_seconds, user_name, manager_id, org_id: userOrgId } = metadataRes.rows[0];

    // If no limit or no manager, nothing to do
    if (!max_duration_seconds || !manager_id) return;

    // Use passed orgId or fall back to user's org_id
    const finalOrgId = orgId || userOrgId;

    // 2. Calculate Total Usage for Today
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
           AND start_time::DATE = CURRENT_DATE`,
        [userId, breakTypeId]
    );

    const totalUsed = parseInt(usageRes.rows[0].total_used || 0);

    // 3. Check Violation
    if (totalUsed > max_duration_seconds) {
        const excess = totalUsed - max_duration_seconds;
        const excessMinutes = Math.ceil(excess / 60);

        // 4. Check if already notified TODAY for this break type
        const existingNotif = await query(
            `SELECT id FROM notifications 
             WHERE recipient_id = $1 
               AND actor_id = $2 
               AND type = 'BREAK_VIOLATION'
               AND title LIKE $3
               AND created_at::DATE = CURRENT_DATE`,
            [manager_id, userId, `%${break_name}%`]
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
        // 1. Get all active break types
        const breaksResult = await query(
            'SELECT id, name, max_duration_seconds, is_paid FROM break_master WHERE org_id = $1 AND is_active = true ORDER BY name ASC',
            [targetOrgId]
        );

        // 2. Calculate used time for each break type for the current day
        const userId = req.user.id;
        const usageResult = await query(
            `SELECT break_type_id, 
                    SUM(
                        CASE 
                            WHEN duration_seconds IS NOT NULL THEN duration_seconds
                            WHEN end_time IS NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
                            ELSE 0 
                        END
                    ) as total_used_seconds
             FROM break_logs 
             WHERE user_id = $1 
               AND start_time::DATE = CURRENT_DATE
             GROUP BY break_type_id`,
            [userId]
        );

        // Map usage to a lookup object
        const usageMap = {};
        usageResult.rows.forEach(row => {
            usageMap[row.break_type_id] = Math.floor(parseFloat(row.total_used_seconds) || 0);
        });

        // 3. Merge usage into break types
        const breaksWithUsage = breaksResult.rows.map(b => {
            const used = usageMap[b.id] || 0;
            return {
                ...b,
                used_seconds: used,
                remaining_seconds: b.max_duration_seconds ? Math.max(0, b.max_duration_seconds - used) : null
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
