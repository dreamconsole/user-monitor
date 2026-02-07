import { query } from '../db.js';

/**
 * GET /reports/summary
 * Filters: startDate, endDate, userId (optional)
 * Role: Admin (all), Manager (team only)
 */
export const getDailySummary = async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    try {
        let sql = `
            SELECT 
                ws.work_date,
                u.full_name as user_name,
                SUM(ws.total_work_seconds) / 3600.0 as work_hours,
                SUM(ws.total_idle_seconds) / 3600.0 as idle_hours
            FROM work_sessions ws
            JOIN users u ON ws.user_id = u.id
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

        // Role-based filtering
        if (role === 'manager') {
            paramCount++;
            sql += ` AND (u.manager_id = $${paramCount} OR u.id = $${paramCount})`;
            params.push(currentUserId);
        } else if (role === 'user') {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(currentUserId);
        }

        // Specific user filter
        if (userId && role !== 'user') {
            paramCount++;
            sql += ` AND u.id = $${paramCount}`;
            params.push(userId);
        }

        sql += ` GROUP BY work_date, u.full_name ORDER BY work_date DESC, u.full_name ASC`;

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('getDailySummary error:', error);
        res.status(500).json({ error: 'Failed to fetch daily summary' });
    }
};

/**
 * GET /reports/breaks
 * Filters: startDate, endDate, userId (optional)
 */
export const getBreakUsage = async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    try {
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
            paramCount++;
            sql += ` AND (u.manager_id = $${paramCount} OR u.id = $${paramCount})`;
            params.push(currentUserId);
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
        res.json(result.rows);
    } catch (error) {
        console.error('getBreakUsage error:', error);
        res.status(500).json({ error: 'Failed to fetch break usage' });
    }
};

/**
 * GET /reports/screenshots
 */
export const getScreenshots = async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    const orgId = req.user.org_id;
    const { role, id: currentUserId } = req.user;

    try {
        let sql = `
            SELECT 
                s.id,
                s.captured_at,
                s.file_path,
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
            paramCount++;
            sql += ` AND (u.manager_id = $${paramCount} OR u.id = $${paramCount})`;
            params.push(currentUserId);
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
        res.json(result.rows);
    } catch (error) {
        console.error('getScreenshots error:', error);
        res.status(500).json({ error: 'Failed to fetch screenshots' });
    }
};
