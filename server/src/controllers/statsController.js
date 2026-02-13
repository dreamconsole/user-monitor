import { query } from '../db.js';

export const getAdminStats = async (req, res) => {
    const orgId = req.user.org_id;
    try {
        const orgInfo = await query('SELECT timezone FROM organizations WHERE id = $1', [orgId]);
        const orgTimezone = orgInfo.rows[0]?.timezone || 'UTC';

        const totalUsers = await query('SELECT COUNT(*) FROM users WHERE org_id = $1', [orgId]);

        const activeUsers = await query(
            `SELECT COUNT(DISTINCT user_id) FROM agent_sessions 
             WHERE org_id = $1 AND last_heartbeat_at > NOW() - INTERVAL '5 minutes'`,
            [orgId]
        );

        const todayStats = await query(
            `SELECT 
                SUM(total_work_seconds) as total_work,
                SUM(total_idle_seconds) as total_idle
             FROM work_sessions 
             WHERE org_id = $1 AND DATE(start_time) = CURRENT_DATE`,
            [orgId]
        );

        const notLoggedIn = await query(
            `SELECT COUNT(*) FROM users u
             LEFT JOIN work_sessions ws ON u.id = ws.user_id AND DATE(ws.start_time) = CURRENT_DATE
             WHERE u.org_id = $1 AND ws.id IS NULL AND u.is_active = true`,
            [orgId]
        );

        // --- NEW: Dashboard Analytics ---

        // 1. Productivity Trend (Last 7 Days)
        const trend = await query(
            `SELECT 
                DATE(start_time) as date, 
                SUM(total_work_seconds) as work_seconds, 
                SUM(total_idle_seconds) as idle_seconds
             FROM work_sessions 
             WHERE org_id = $1 AND start_time > CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(start_time)
             ORDER BY date ASC`,
            [orgId]
        );

        // 2. Status Distribution (Online vs Offline)
        // Online = heartbeat < 2 mins ago
        const statusDist = await query(
            `SELECT
                COUNT(*) FILTER (WHERE last_heartbeat > NOW() - INTERVAL '2 minutes') as online,
                COUNT(*) FILTER (WHERE last_heartbeat <= NOW() - INTERVAL '2 minutes' OR last_heartbeat IS NULL) as offline
             FROM users
             WHERE org_id = $1 AND is_active = true`,
            [orgId]
        );

        res.json({
            totalUsers: parseInt(totalUsers.rows[0].count),
            activeUsers: parseInt(activeUsers.rows[0].count),
            totalWorkHours: (parseInt(todayStats.rows[0].total_work || 0) / 3600).toFixed(1),
            totalIdleHours: (parseInt(todayStats.rows[0].total_idle || 0) / 3600).toFixed(1),
            notLoggedInCount: parseInt(notLoggedIn.rows[0].count),
            orgTimezone,
            productivityTrend: trend.rows,
            statusDistribution: {
                online: parseInt(statusDist.rows[0].online || 0),
                offline: parseInt(statusDist.rows[0].offline || 0)
            }
        });
    } catch (error) {
        console.error('getAdminStats error:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
};

export const getManagerStats = async (req, res) => {
    const orgId = req.user.org_id;
    const managerId = req.user.id;
    try {
        const teamStats = await query(
            `SELECT 
                u.full_name as name,
                u.timezone,
                COALESCE(ws.total_work_seconds, 0) as work_seconds,
                COALESCE(ws.total_idle_seconds, 0) as idle_seconds,
                ws.start_time,
                u.last_heartbeat
             FROM users u
             LEFT JOIN work_sessions ws ON u.id = ws.user_id AND DATE(ws.start_time) = CURRENT_DATE
             WHERE u.org_id = $1 AND (u.manager_id = $2 OR u.id = $2)`,
            [orgId, managerId]
        );

        // Simple late login detection (e.g., after 9:30 AM)
        const lateLogins = teamStats.rows.filter(r => {
            if (!r.start_time) return false;
            const start = new Date(r.start_time);
            return start.getHours() > 9 || (start.getHours() === 9 && start.getMinutes() > 30);
        });

        const highIdle = teamStats.rows.filter(r => {
            const total = r.work_seconds + r.idle_seconds;
            if (total === 0) return false;
            return (r.idle_seconds / total) > 0.3; // More than 30% idle
        });

        // --- NEW: Dashboard Analytics for Manager ---

        // 1. Team Productivity Trend (Last 7 Days)
        const trend = await query(
            `SELECT 
                DATE(ws.start_time) as date, 
                SUM(ws.total_work_seconds) as work_seconds, 
                SUM(ws.total_idle_seconds) as idle_seconds
             FROM work_sessions ws
             JOIN users u ON u.id = ws.user_id
             WHERE u.org_id = $1 
               AND (u.manager_id = $2 OR u.id = $2)
               AND ws.start_time > CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(ws.start_time)
             ORDER BY date ASC`,
            [orgId, managerId]
        );

        // 2. Team Status Distribution
        const now = new Date();
        const twoMinsAgo = new Date(now.getTime() - 2 * 60000);

        // Calculate from teamStats which basically has the user rows
        let onlineCount = 0;
        let offlineCount = 0;

        teamStats.rows.forEach(user => {
            if (user.last_heartbeat && new Date(user.last_heartbeat) > twoMinsAgo) {
                onlineCount++;
            } else {
                offlineCount++;
            }
        });

        res.json({
            teamSummary: teamStats.rows,
            lateLoginsCount: lateLogins.length,
            highIdleCount: highIdle.length,
            productivityTrend: trend.rows,
            statusDistribution: {
                online: onlineCount,
                offline: offlineCount
            }
        });
    } catch (error) {
        console.error('getManagerStats error:', error);
        res.status(500).json({ error: 'Failed to fetch manager stats' });
    }
};

export const getUserStats = async (req, res) => {
    const userId = req.user.id;
    const orgId = req.user.org_id;
    try {
        const user = await query('SELECT timezone FROM users WHERE id = $1', [userId]);
        const userTimezone = user.rows[0]?.timezone || 'UTC';

        const today = await query(
            `SELECT * FROM work_sessions 
             WHERE user_id = $1 AND DATE(start_time) = CURRENT_DATE`,
            [userId]
        );

        const weekly = await query(
            `SELECT 
                DATE(start_time) as date,
                SUM(total_work_seconds) / 3600.0 as hours
             FROM work_sessions 
             WHERE user_id = $1 AND DATE(start_time) > CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(start_time)
             ORDER BY DATE(start_time) ASC`,
            [userId]
        );

        res.json({
            today: today.rows[0] || null,
            weekly: weekly.rows,
            userTimezone
        });
    } catch (error) {
        console.error('getUserStats error:', error);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
};

export const getUserHourlyStats = async (req, res) => {
    const { userId } = req.params;
    const { date } = req.query; // YYYY-MM-DD
    const orgId = req.user.org_id;

    // Security check: Ensure requester can view this user
    if (req.user.role !== 'orgadmin' && req.user.id !== userId) {
        // If manager, check if user reports to them
        if (req.user.role === 'manager') {
            const userCheck = await query('SELECT manager_id FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0 || userCheck.rows[0].manager_id !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to view this user stats' });
            }
        } else {
            return res.status(403).json({ error: 'Unauthorized' });
        }
    }

    try {
        const queryDate = date || new Date().toISOString().split('T')[0];

        // 1. Hourly Stats (Existing Logic)
        const sqlHourly = `
            SELECT 
                EXTRACT(HOUR FROM start_time) as hour,
                SUM(total_work_seconds) as work_seconds,
                SUM(total_idle_seconds) as idle_seconds
            FROM work_sessions
            WHERE user_id = $1 
              AND DATE(start_time) = $2
              AND org_id = $3
            GROUP BY EXTRACT(HOUR FROM start_time)
            ORDER BY hour ASC
        `;

        const resultHourly = await query(sqlHourly, [userId, queryDate, orgId]);

        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            active_seconds: 0,
            idle_seconds: 0
        }));

        resultHourly.rows.forEach(row => {
            const hour = parseInt(row.hour);
            if (hourlyData[hour]) {
                hourlyData[hour].active_seconds = parseInt(row.work_seconds || 0);
                hourlyData[hour].idle_seconds = parseInt(row.idle_seconds || 0);
            }
        });

        // 2. Daily Totals
        const sqlTotals = `
            SELECT 
                SUM(total_work_seconds) as total_work,
                SUM(total_idle_seconds) as total_idle,
                (SELECT SUM(duration_seconds) FROM break_logs WHERE user_id = $1 AND DATE(start_time) = $2) as total_break
            FROM work_sessions
            WHERE user_id = $1 AND DATE(start_time) = $2 AND org_id = $3
        `;
        const resultTotals = await query(sqlTotals, [userId, queryDate, orgId]);

        // Check current status for "Today" view (if querying today)
        let currentStatus = 'offline';
        if (queryDate === new Date().toISOString().split('T')[0]) {
            const userStatus = await query(
                `SELECT last_heartbeat, 
                  EXISTS(SELECT 1 FROM break_logs WHERE user_id = $1 AND end_time IS NULL) as on_break
                  FROM users WHERE id = $1`,
                [userId]
            );
            if (userStatus.rows.length > 0) {
                const u = userStatus.rows[0];
                if (u.on_break) currentStatus = 'break';
                else if (u.last_heartbeat && (Date.now() - new Date(u.last_heartbeat).getTime() < 2 * 60 * 1000)) currentStatus = 'online';
            }
        }

        // 3. Activity Logs (Sessions & Breaks)
        // Combine work_sessions and break_logs into a single list
        const sqlLogs = `
            SELECT 'session' as type, start_time, end_time, total_work_seconds as duration, total_idle_seconds as idle
            FROM work_sessions
            WHERE user_id = $1 AND DATE(start_time) = $2
            UNION ALL
            SELECT 'break' as type, start_time, end_time, duration_seconds as duration, 0 as idle
            FROM break_logs
            WHERE user_id = $1 AND DATE(start_time) = $2
            ORDER BY start_time DESC
        `;
        const resultLogs = await query(sqlLogs, [userId, queryDate]);

        res.json({
            hourly: hourlyData,
            totals: {
                work_seconds: parseInt(resultTotals.rows[0]?.total_work || 0),
                idle_seconds: parseInt(resultTotals.rows[0]?.total_idle || 0),
                break_seconds: parseInt(resultTotals.rows[0]?.total_break || 0),
                status: currentStatus
            },
            logs: resultLogs.rows
        });
    } catch (error) {
        console.error('getUserHourlyStats error:', error);
        res.status(500).json({ error: 'Failed to fetch hourly stats' });
    }
};
