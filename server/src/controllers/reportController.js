import { query } from '../db.js';

/**
 * Fetches daily summary data. Used by reports API and PDF export.
 * @param {Object} req - Express request with user and query params
 * @returns {Promise<Array>} Rows
 */
export async function fetchDailySummaryData(req) {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    let sql = `
            SELECT 
                ws.work_date,
                u.id as user_id,
                u.full_name as user_name,
                c.name as campaign_name,
                SUM(ws.total_work_seconds) / 3600.0 as work_hours,
                SUM(ws.total_idle_seconds) / 3600.0 as idle_hours,
                MIN(ws.start_time) as shift_start,
                MAX(ws.end_time) as shift_end,
                (SELECT COALESCE(SUM(duration_seconds), 0) 
                 FROM break_logs bl 
                 WHERE bl.user_id = u.id 
                   AND DATE(bl.start_time) = ws.work_date
                ) as break_seconds
            FROM work_sessions ws
            JOIN users u ON ws.user_id = u.id
            LEFT JOIN campaigns c ON ws.campaign_id = c.id
            WHERE ws.org_id = $1
        `;
    const params = [orgId];
    let paramCount = 1;

    if (startDate) {
        paramCount++;
        sql += ` AND ws.start_time >= $${paramCount}`;
        params.push(`${startDate} 00:00:00+00`);
    }
    if (endDate) {
        paramCount++;
        sql += ` AND ws.start_time <= $${paramCount}`;
        params.push(`${endDate} 23:59:59+00`);
    }

    if (role === 'manager') {
        // Always exclude orgadmins from manager's view
        sql += ` AND u.role != 'orgadmin'`;
        if (req.user.team_id) {
            paramCount++;
            sql += ` AND (u.team_id = $${paramCount} OR u.id = $${paramCount + 1})`;
            params.push(req.user.team_id, currentUserId);
            paramCount++;
        } else {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(currentUserId);
        }
    } else if (role === 'user') {
        paramCount++;
        sql += ` AND u.id = $${paramCount}`;
        params.push(currentUserId);
    }

    if (userId && role !== 'user') {
        paramCount++;
        sql += ` AND u.id = $${paramCount}`;
        params.push(userId);
    }

    sql += ` GROUP BY ws.work_date, u.id, u.full_name, c.name ORDER BY ws.work_date DESC, u.full_name ASC`;

    const result = await query(sql, params);
    return result.rows;
}

/**
 * GET /reports/summary
 * Filters: startDate, endDate, userId (optional)
 * Role: Admin (all), Manager (team only)
 */
export const getDailySummary = async (req, res) => {
    try {
        const rows = await fetchDailySummaryData(req);
        res.json(rows);
    } catch (error) {
        console.error('getDailySummary error:', error);
        res.status(500).json({ error: 'Failed to fetch daily summary' });
    }
};

/**
 * Fetches break usage data. Used by reports API and PDF export.
 */
export async function fetchBreakUsageData(req) {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    let sql = `
            SELECT 
                bl.start_time,
                bl.end_time,
                u.full_name as user_name,
                bm.name as break_type,
                EXTRACT(EPOCH FROM (bl.end_time - bl.start_time)) / 60.0 as duration_minutes
            FROM break_logs bl
            JOIN users u ON bl.user_id = u.id
            JOIN break_master bm ON bl.break_type_id = bm.id
            WHERE bl.org_id = $1
        `;
    const params = [orgId];
    let paramCount = 1;

    if (startDate) {
        paramCount++;
        sql += ` AND bl.start_time >= $${paramCount}`;
        params.push(`${startDate} 00:00:00+00`);
    }
    if (endDate) {
        paramCount++;
        sql += ` AND bl.start_time <= $${paramCount}`;
        params.push(`${endDate} 23:59:59+00`);
    }

    if (role === 'manager') {
        // Always exclude orgadmins from manager's view
        sql += ` AND u.role != 'orgadmin'`;
        if (req.user.team_id) {
            paramCount++;
            sql += ` AND (u.team_id = $${paramCount} OR u.id = $${paramCount + 1})`;
            params.push(req.user.team_id, currentUserId);
            paramCount++;
        } else {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(currentUserId);
        }
    } else if (role === 'user') {
        paramCount++;
        sql += ` AND u.id = $${paramCount}`;
        params.push(currentUserId);
    }

    if (userId && role !== 'user') {
        paramCount++;
        sql += ` AND u.id = $${paramCount}`;
        params.push(userId);
    }

    sql += ` ORDER BY bl.start_time DESC`;

    const result = await query(sql, params);
    return result.rows;
}

/**
 * GET /reports/breaks
 * Filters: startDate, endDate, userId (optional)
 */
export const getBreakUsage = async (req, res) => {
    try {
        const rows = await fetchBreakUsageData(req);
        res.json(rows);
    } catch (error) {
        console.error('getBreakUsage error:', error);
        res.status(500).json({ error: 'Failed to fetch break usage' });
    }
};

/**
 * Fetches screenshots data. Used by reports API and PDF export.
 */
export async function fetchScreenshotsData(req) {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    let sql = `
            SELECT 
                s.id,
                s.captured_at,
                s.storage_path as file_path,
                u.full_name as user_name
            FROM screenshots s
            JOIN users u ON s.user_id = u.id
            WHERE s.org_id = $1
        `;
    const params = [orgId];
    let paramCount = 1;

    if (startDate) {
        paramCount++;
        sql += ` AND s.captured_at >= $${paramCount}`;
        params.push(`${startDate} 00:00:00+00`);
    }
    if (endDate) {
        paramCount++;
        sql += ` AND s.captured_at <= $${paramCount}`;
        params.push(`${endDate} 23:59:59+00`);
    }

    if (role === 'manager') {
        // Always exclude orgadmins from manager's view
        sql += ` AND u.role != 'orgadmin'`;
        if (req.user.team_id) {
            paramCount++;
            sql += ` AND (u.team_id = $${paramCount} OR u.id = $${paramCount + 1})`;
            params.push(req.user.team_id, currentUserId);
            paramCount++;
        } else {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(currentUserId);
        }
    } else if (role === 'user') {
        paramCount++;
        sql += ` AND u.id = $${paramCount}`;
        params.push(currentUserId);
    }

    if (userId && role !== 'user') {
        paramCount++;
        sql += ` AND u.id = $${paramCount}`;
        params.push(userId);
    }

    sql += ` ORDER BY s.captured_at DESC LIMIT 100`;

    const result = await query(sql, params);
    return result.rows;
}

/**
 * GET /reports/screenshots
 */
export const getScreenshots = async (req, res) => {
    try {
        const rows = await fetchScreenshotsData(req);
        res.json(rows);
    } catch (error) {
        console.error('getScreenshots error:', error);
        res.status(500).json({ error: 'Failed to fetch screenshots' });
    }
};
export const getIdleEvents = async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    try {
        let sql = `
            SELECT 
                al.log_time,
                al.state,
                u.id as user_id,
                u.full_name as user_name
            FROM activity_logs al
            JOIN users u ON al.user_id = u.id
            WHERE al.org_id = $1 AND al.state = 'idle'
        `;
        const params = [orgId];
        let paramCount = 1;

        if (startDate) {
            paramCount++;
            sql += ` AND al.log_time >= $${paramCount}`;
            params.push(`${startDate} 00:00:00+00`);
        }
        if (endDate) {
            paramCount++;
            sql += ` AND al.log_time <= $${paramCount}`;
            params.push(`${endDate} 23:59:59+00`);
        }

        if (role === 'manager') {
            // Always exclude orgadmins from manager's view
            sql += ` AND u.role != 'orgadmin'`;
            if (req.user.team_id) {
                paramCount++;
                sql += ` AND (u.team_id = $${paramCount} OR u.id = $${paramCount + 1})`;
                params.push(req.user.team_id, currentUserId);
                paramCount++;
            } else {
                paramCount++;
                sql += ` AND u.id = $${paramCount}`;
                params.push(currentUserId);
            }
        } else if (role === 'user') {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(currentUserId);
        }

        if (userId && role !== 'user') {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(userId);
        }

        sql += ` ORDER BY u.id, al.log_time ASC`;

        const result = await query(sql, params);
        const rows = result.rows;

        // Aggregate consecutive idle logs into events
        const events = [];
        if (rows.length === 0) return res.json(events);

        let currentEvent = null;
        const GAP_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes gap breaks the event

        for (const row of rows) {
            const logTime = new Date(row.log_time).getTime();

            if (!currentEvent) {
                currentEvent = {
                    user_id: row.user_id,
                    user_name: row.user_name,
                    start_time: row.log_time,
                    end_time: row.log_time,
                    duration_minutes: 0
                };
                continue;
            }

            // Check if same user and within threshold
            const lastTime = new Date(currentEvent.end_time).getTime();
            const diff = logTime - lastTime;

            if (row.user_id === currentEvent.user_id && diff <= GAP_THRESHOLD_MS) {
                // Extend current event
                currentEvent.end_time = row.log_time;
                currentEvent.duration_minutes = (logTime - new Date(currentEvent.start_time).getTime()) / 60000;
            } else {
                // Push completed event (filter out tiny blips if needed, e.g. < 1 min)
                if (currentEvent.duration_minutes > 1) {
                    events.push(currentEvent);
                }
                // Start new event
                currentEvent = {
                    user_id: row.user_id,
                    user_name: row.user_name,
                    start_time: row.log_time,
                    end_time: row.log_time,
                    duration_minutes: 0
                };
            }
        }
        // Push last event
        if (currentEvent && currentEvent.duration_minutes > 1) {
            events.push(currentEvent);
        }

        // Sort by start_time descending for display
        events.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

        res.json(events);
    } catch (error) {
        console.error('getIdleEvents error:', error);
        res.status(500).json({ error: 'Failed to fetch idle events' });
    }
};
