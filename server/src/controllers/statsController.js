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

        res.json({
            totalUsers: parseInt(totalUsers.rows[0].count),
            activeUsers: parseInt(activeUsers.rows[0].count),
            totalWorkHours: (parseInt(todayStats.rows[0].total_work || 0) / 3600).toFixed(1),
            totalIdleHours: (parseInt(todayStats.rows[0].total_idle || 0) / 3600).toFixed(1),
            notLoggedInCount: parseInt(notLoggedIn.rows[0].count),
            orgTimezone
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
                ws.start_time
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

        res.json({
            teamSummary: teamStats.rows,
            lateLoginsCount: lateLogins.length,
            highIdleCount: highIdle.length
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
