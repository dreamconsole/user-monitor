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
    const teamId = req.user.team_id;
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
             WHERE u.org_id = $1 AND (u.team_id = $2 OR u.id = $3)`,
            [orgId, teamId, req.user.id]
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
               AND (u.team_id = $2 OR u.id = $3)
               AND ws.start_time > CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(ws.start_time)
             ORDER BY date ASC`,
            [orgId, teamId, req.user.id]
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
            const userCheck = await query('SELECT team_id FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0 || userCheck.rows[0].team_id !== req.user.team_id) {
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

// ═══════════════════════════════════════════════════════════════
// Timeline API (Time Doctor / Clockify style)
// Supports: ?view=month  and  ?view=day
// ═══════════════════════════════════════════════════════════════
export const getTimelineData = async (req, res) => {
    const { view, user_id, month, date } = req.query;
    const orgId = req.user.org_id;

    // --- Role-based access control ---
    let targetUserId = user_id;

    if (req.user.role === 'user') {
        // Regular users can only view their own timeline
        targetUserId = req.user.id;
    } else if (req.user.role === 'manager' && targetUserId && targetUserId !== req.user.id) {
        // Managers can only view their direct reports
        const userCheck = await query('SELECT team_id FROM users WHERE id = $1 AND org_id = $2', [targetUserId, orgId]);
        if (userCheck.rows.length === 0 || userCheck.rows[0].team_id !== req.user.team_id) {
            return res.status(403).json({ error: 'Unauthorized: not your direct report' });
        }
    }
    // orgadmin can view any user in their org (no additional check needed)

    if (!targetUserId) {
        targetUserId = req.user.id;
    }

    try {
        if (view === 'month') {
            return await handleMonthView(req, res, targetUserId, orgId, month);
        } else if (view === 'day') {
            return await handleDayView(req, res, targetUserId, orgId, date);
        } else {
            return res.status(400).json({ error: 'Invalid view parameter. Use "month" or "day".' });
        }
    } catch (error) {
        console.error('getTimelineData error:', error);
        res.status(500).json({ error: 'Failed to fetch timeline data' });
    }
};

async function handleMonthView(req, res, userId, orgId, month) {
    // month = "2026-02" => first day to last day
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const startDate = `${targetMonth}-01`;
    // Calculate last day of month
    const [y, m] = targetMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

    const dailyStats = await query(
        `SELECT
            ws.work_date,
            SUM(ws.total_work_seconds) as work_seconds,
            SUM(ws.total_idle_seconds) as idle_seconds,
            SUM(ws.total_break_seconds) as break_seconds,
            MIN(ws.start_time) as first_clock_in,
            MAX(ws.end_time) as last_clock_out,
            (SELECT COUNT(*) FROM screenshots s
             WHERE s.user_id = $1 AND s.captured_at::date = ws.work_date) as screenshot_count
         FROM work_sessions ws
         WHERE ws.user_id = $1 AND ws.org_id = $2
           AND ws.work_date BETWEEN $3 AND $4
         GROUP BY ws.work_date
         ORDER BY ws.work_date`,
        [userId, orgId, startDate, endDate]
    );

    res.json({
        month: targetMonth,
        user_id: userId,
        days: dailyStats.rows.map(row => ({
            work_date: row.work_date,
            work_seconds: parseInt(row.work_seconds || 0),
            idle_seconds: parseInt(row.idle_seconds || 0),
            break_seconds: parseInt(row.break_seconds || 0),
            first_clock_in: row.first_clock_in,
            last_clock_out: row.last_clock_out,
            screenshot_count: parseInt(row.screenshot_count || 0)
        }))
    });
}

async function handleDayView(req, res, userId, orgId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Work Sessions
    const sessionsResult = await query(
        `SELECT id, start_time, end_time, total_work_seconds, total_idle_seconds,
                total_break_seconds, status
         FROM work_sessions
         WHERE user_id = $1 AND org_id = $2 AND work_date = $3
         ORDER BY start_time`,
        [userId, orgId, targetDate]
    );

    // 2. Break Blocks
    const breaksResult = await query(
        `SELECT bl.id, bl.start_time, bl.end_time, bl.duration_seconds,
                COALESCE(bm.name, 'Break') as break_name, bm.is_paid
         FROM break_logs bl
         LEFT JOIN break_master bm ON bl.break_type_id = bm.id
         WHERE bl.user_id = $1 AND bl.org_id = $2 AND DATE(bl.start_time) = $3
         ORDER BY bl.start_time`,
        [userId, orgId, targetDate]
    );

    // 3. Activity State Changes (for intensity bar)
    const activityResult = await query(
        `SELECT log_time, state, keyboard_events, mouse_events
         FROM activity_logs
         WHERE user_id = $1 AND org_id = $2 AND DATE(log_time) = $3
         ORDER BY log_time`,
        [userId, orgId, targetDate]
    );

    // 4. App Usage Segments
    const appsResult = await query(
        `SELECT aul.start_time, aul.end_time, aul.duration_seconds,
                COALESCE(ta.display_name, ta.executable_name, 'Unknown') as app_name,
                ta.executable_name,
                ac.productivity_type,
                ac.name as category_name
         FROM app_usage_logs aul
         LEFT JOIN tracked_apps ta ON aul.app_id = ta.id
         LEFT JOIN app_categories ac ON ta.category_id = ac.id
         WHERE aul.user_id = $1 AND aul.org_id = $2 AND aul.log_date = $3
         ORDER BY aul.start_time`,
        [userId, orgId, targetDate]
    );

    // 5. Screenshots
    const screenshotsResult = await query(
        `SELECT id, captured_at, storage_path
         FROM screenshots
         WHERE user_id = $1 AND org_id = $2 AND DATE(captured_at) = $3
         ORDER BY captured_at`,
        [userId, orgId, targetDate]
    );

    // Calculate totals
    const sessions = sessionsResult.rows;
    const totalWork = sessions.reduce((s, r) => s + parseInt(r.total_work_seconds || 0), 0);
    const totalIdle = sessions.reduce((s, r) => s + parseInt(r.total_idle_seconds || 0), 0);
    const totalBreak = sessions.reduce((s, r) => s + parseInt(r.total_break_seconds || 0), 0);
    const firstClockIn = sessions.length > 0 ? sessions[0].start_time : null;
    const lastClockOut = sessions.length > 0 ? sessions[sessions.length - 1].end_time : null;

    // Build activity intensity buckets (10-minute intervals)
    const intensityBuckets = [];
    if (activityResult.rows.length > 0) {
        // Group by 10-minute intervals
        const bucketMap = {};
        activityResult.rows.forEach(row => {
            const t = new Date(row.log_time);
            const bucketKey = `${String(t.getUTCHours()).padStart(2, '0')}:${String(Math.floor(t.getUTCMinutes() / 10) * 10).padStart(2, '0')}`;
            if (!bucketMap[bucketKey]) {
                bucketMap[bucketKey] = { time: bucketKey, keyboard: 0, mouse: 0, count: 0 };
            }
            bucketMap[bucketKey].keyboard += parseInt(row.keyboard_events || 0);
            bucketMap[bucketKey].mouse += parseInt(row.mouse_events || 0);
            bucketMap[bucketKey].count++;
        });
        Object.values(bucketMap).sort((a, b) => a.time.localeCompare(b.time)).forEach(b => intensityBuckets.push(b));
    }

    res.json({
        date: targetDate,
        user_id: userId,
        sessions: sessions.map(s => ({
            id: s.id,
            start_time: s.start_time,
            end_time: s.end_time,
            work_seconds: parseInt(s.total_work_seconds || 0),
            idle_seconds: parseInt(s.total_idle_seconds || 0),
            status: s.status
        })),
        breaks: breaksResult.rows.map(b => ({
            id: b.id,
            start_time: b.start_time,
            end_time: b.end_time,
            duration_seconds: parseInt(b.duration_seconds || 0),
            break_name: b.break_name,
            is_paid: b.is_paid
        })),
        activity: intensityBuckets,
        apps: appsResult.rows.map(a => ({
            start_time: a.start_time,
            end_time: a.end_time,
            duration_seconds: parseInt(a.duration_seconds || 0),
            app_name: a.app_name,
            executable_name: a.executable_name,
            productivity_type: a.productivity_type || 'neutral',
            category_name: a.category_name
        })),
        screenshots: screenshotsResult.rows.map(s => ({
            id: s.id,
            captured_at: s.captured_at,
            storage_path: s.storage_path
        })),
        totals: {
            work_seconds: totalWork,
            idle_seconds: totalIdle,
            break_seconds: totalBreak,
            first_clock_in: firstClockIn,
            last_clock_out: lastClockOut
        }
    });
}
