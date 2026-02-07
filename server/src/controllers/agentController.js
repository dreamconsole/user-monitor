import { query } from '../db.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const logHeartbeat = async (req, res) => {
    const { org_id, user_id, device_identifier } = req.body;
    try {
        // Update last_heartbeat_at in agent_sessions
        await query(
            'UPDATE agent_sessions SET last_heartbeat_at = CURRENT_TIMESTAMP WHERE org_id = $1 AND user_id = $2 AND device_identifier = $3',
            [org_id, user_id, device_identifier]
        );

        // Record historical heartbeat
        console.log(`[logHeartbeat] Recording for User: ${user_id}, Org: ${org_id}`);
        await query(
            'INSERT INTO heartbeats (org_id, user_id, device_id, status) VALUES ($1, $2, $3, $4)',
            [org_id, user_id, device_identifier, 'ONLINE']
        );

        // Update users table with latest tracking info
        // We also check for token and agent_version if passed in heartbeat
        const { agent_version, token } = req.body;
        await query(
            `UPDATE users SET 
                last_heartbeat = CURRENT_TIMESTAMP,
                device_id = $1,
                agent_version = COALESCE($2, agent_version),
                token = COALESCE($3, token)
            WHERE id = $4`,
            [device_identifier, agent_version || null, token || null, user_id]
        );

        // Check for force_logout flag
        const userResult = await query('SELECT force_logout FROM users WHERE id = $1', [user_id]);
        const forceLogout = userResult.rows[0]?.force_logout;

        if (forceLogout) {
            // Reset the flag and tell the agent to logout
            await query('UPDATE users SET force_logout = false WHERE id = $1', [user_id]);
            return res.status(200).json({ success: true, command: 'FORCE_LOGOUT' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[logHeartbeat] CRITICAL ERROR:', error);
        res.status(500).json({
            error: 'Failed to log heartbeat',
            details: error.message,
            code: error.code
        });
    }
};

export const syncActivitySession = async (req, res) => {
    const { id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, status } = req.body;
    try {
        // activity_sessions is now work_sessions
        // Calculate work_date based on start_time AT TIME ZONE user's timezone
        await query(
            `INSERT INTO work_sessions (id, org_id, user_id, start_time, end_time, total_work_seconds, total_idle_seconds, total_break_seconds, status, work_date)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, ($4::TIMESTAMPTZ AT TIME ZONE COALESCE(u.timezone, 'UTC'))::DATE
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
        res.status(500).json({
            success: false,
            error: 'Failed to sync work session',
            details: error.message,
            code: error.code // PostgreSQL error code
        });
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
        res.status(500).json({ error: 'Failed to upload screenshot: ' + error.message });
    }
};

export const logActivity = async (req, res) => {
    const { org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state, metadata } = req.body;
    console.log('[logActivity] RECEIVED:', { org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state });

    try {
        const result = await query(
            `INSERT INTO activity_logs (org_id, user_id, session_id, log_time, keyboard_events, mouse_events, state, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [org_id, user_id, session_id, log_time, keyboard_events || 0, mouse_events || 0, state, metadata || null]
        );
        console.log('[logActivity] SUCCESS, inserted ID:', result.rows[0].id);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[logActivity] CRITICAL ERROR:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to log activity',
            details: error.message,
            code: error.code
        });
    }
};

export const logBreak = async (req, res) => {
    const { id, org_id, user_id, session_id, break_type_id, start_time, end_time, duration_seconds } = req.body;

    try {
        let finalBreakTypeId = break_type_id;

        // If break_type_id is not a UUID, try to find it by name
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (break_type_id && !UUID_REGEX.test(break_type_id)) {
            const btResult = await query(
                'SELECT id FROM break_master WHERE org_id = $1 AND name ILIKE $2 || \'%\'',
                [org_id, break_type_id]
            );
            if (btResult.rows.length > 0) {
                finalBreakTypeId = btResult.rows[0].id;
            } else {
                finalBreakTypeId = null;
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
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Break log failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to log break',
            details: error.message,
            code: error.code
        });
    }
};
