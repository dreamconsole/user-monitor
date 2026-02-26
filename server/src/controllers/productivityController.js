import { query } from '../db.js';

/**
 * Resolve target user ID with role-based access control.
 * Returns { targetUserId, error } - error is set if unauthorized.
 */
async function resolveTargetUser(req, orgId) {
    const requestedUserId = req.query.userId;
    const role = req.user.role;
    const currentUserId = req.user.id;

    if (role === 'user') {
        return { targetUserId: currentUserId };
    }

    if (!requestedUserId) {
        return { targetUserId: currentUserId };
    }

    if (role === 'orgadmin') {
        const userCheck = await query(
            'SELECT id FROM users WHERE id = $1 AND org_id = $2',
            [requestedUserId, orgId]
        );
        if (userCheck.rows.length === 0) {
            return { error: 'User not found' };
        }
        return { targetUserId: requestedUserId };
    }

    if (role === 'manager') {
        if (requestedUserId === currentUserId) {
            return { targetUserId: currentUserId };
        }
        const userCheck = await query(
            'SELECT team_id FROM users WHERE id = $1 AND org_id = $2',
            [requestedUserId, orgId]
        );
        if (userCheck.rows.length === 0 || userCheck.rows[0].team_id !== req.user.team_id) {
            return { error: 'Unauthorized: not on your team' };
        }
        return { targetUserId: requestedUserId };
    }

    return { targetUserId: currentUserId };
}

/**
 * Calculate productivity score for a single user over a date range.
 */
async function calculateProductivityScore(userId, orgId, startDate, endDate) {
    const expectedShiftSeconds = await getExpectedShiftSeconds(orgId, userId, startDate, endDate);
    const allowedBreakSeconds = await getAllowedBreakSeconds(orgId);

    const workResult = await query(
        `SELECT 
            COALESCE(SUM(total_work_seconds), 0) as total_work_seconds,
            COALESCE(SUM(total_idle_seconds), 0) as total_idle_seconds,
            COALESCE(SUM(total_break_seconds), 0) as total_break_seconds
         FROM work_sessions
         WHERE user_id = $1 AND org_id = $2 AND work_date BETWEEN $3 AND $4`,
        [userId, orgId, startDate, endDate]
    );

    const workRow = workResult.rows[0];
    const totalWorkSeconds = parseInt(workRow.total_work_seconds || 0);
    const totalIdleSeconds = parseInt(workRow.total_idle_seconds || 0);
    const totalBreakSeconds = parseInt(workRow.total_break_seconds || 0);

    const appResult = await query(
        `SELECT 
            COALESCE(SUM(CASE WHEN ac.productivity_type = 'productive' THEN aul.duration_seconds ELSE 0 END), 0) as productive_seconds,
            COALESCE(SUM(CASE WHEN ac.productivity_type = 'non_productive' THEN aul.duration_seconds ELSE 0 END), 0) as non_productive_seconds,
            COALESCE(SUM(CASE WHEN ac.productivity_type = 'neutral' OR ac.productivity_type IS NULL THEN aul.duration_seconds ELSE 0 END), 0) as neutral_seconds
         FROM app_usage_logs aul
         JOIN tracked_apps ta ON aul.app_id = ta.id
         LEFT JOIN app_categories ac ON ta.category_id = ac.id
         WHERE aul.user_id = $1 AND aul.org_id = $2 AND aul.log_date BETWEEN $3 AND $4`,
        [userId, orgId, startDate, endDate]
    );

    const appRow = appResult.rows[0];
    const productiveSeconds = parseInt(appRow.productive_seconds || 0);
    const nonProductiveSeconds = parseInt(appRow.non_productive_seconds || 0);
    const neutralSeconds = parseInt(appRow.neutral_seconds || 0);
    const totalAppSeconds = productiveSeconds + nonProductiveSeconds + neutralSeconds;

    const attendance = expectedShiftSeconds > 0
        ? Math.min(100, (totalWorkSeconds / expectedShiftSeconds) * 100)
        : 100;

    const activity = totalWorkSeconds > 0
        ? Math.min(100, ((totalWorkSeconds - totalIdleSeconds) / totalWorkSeconds) * 100)
        : 100;

    let breaks = 100;
    if (allowedBreakSeconds > 0 && totalBreakSeconds > allowedBreakSeconds) {
        const excess = totalBreakSeconds - allowedBreakSeconds;
        breaks = Math.max(0, 100 - (excess / allowedBreakSeconds) * 100);
    }

    const appProductivity = totalAppSeconds > 0
        ? (productiveSeconds / totalAppSeconds) * 100
        : 100;

    const score = Math.round(
        attendance * 0.30 +
        activity * 0.30 +
        breaks * 0.20 +
        appProductivity * 0.20
    );

    return {
        score: Math.min(100, Math.max(0, score)),
        breakdown: {
            attendance: Math.round(attendance * 10) / 10,
            activity: Math.round(activity * 10) / 10,
            breaks: Math.round(breaks * 10) / 10,
            appProductivity: Math.round(appProductivity * 10) / 10
        }
    };
}

function countWorkDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
        const day = d.getDay();
        if (day >= 1 && day <= 5) count++;
        d.setDate(d.getDate() + 1);
    }
    return count || 1;
}

async function getExpectedShiftSeconds(orgId, userId, startDate, endDate) {
    const workDays = countWorkDays(startDate, endDate);
    let hoursPerDay = 9;
    const userOverride = await query(
        'SELECT shift_duration FROM users WHERE id = $1 AND shift_duration IS NOT NULL',
        [userId]
    );
    if (userOverride.rows.length > 0) {
        hoursPerDay = parseFloat(userOverride.rows[0].shift_duration) || 9;
    } else {
        const orgResult = await query(
            'SELECT shift_duration FROM organizations WHERE id = $1',
            [orgId]
        );
        hoursPerDay = parseFloat(orgResult.rows[0]?.shift_duration) || 9;
    }
    return hoursPerDay * 3600 * workDays;
}

async function getAllowedBreakSeconds(orgId) {
    const result = await query(
        `SELECT COALESCE(SUM(max_duration_seconds), 0) as total
         FROM break_master WHERE org_id = $1 AND is_active = true`,
        [orgId]
    );
    const total = parseInt(result.rows[0]?.total || 0);
    return total > 0 ? total : 3600;
}

/**
 * Get previous period dates (same length as current range).
 */
function getPreviousPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    return {
        startDate: prevStart.toISOString().split('T')[0],
        endDate: prevEnd.toISOString().split('T')[0]
    };
}

export const getProductivityScore = async (req, res) => {
    const orgId = req.user.org_id;

    const resolved = await resolveTargetUser(req, orgId);
    if (resolved.error) {
        return res.status(resolved.error === 'User not found' ? 404 : 403)
            .json({ error: resolved.error });
    }
    const targetUserId = resolved.targetUserId;

    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || today;
    const endDate = req.query.endDate || today;

    try {
        const result = await calculateProductivityScore(
            targetUserId,
            orgId,
            startDate,
            endDate
        );

        const prevPeriod = getPreviousPeriod(startDate, endDate);
        const prevResult = await calculateProductivityScore(
            targetUserId,
            orgId,
            prevPeriod.startDate,
            prevPeriod.endDate
        );

        const trend = result.score - prevResult.score;

        res.json({
            score: result.score,
            breakdown: result.breakdown,
            date: { startDate, endDate },
            trend
        });
    } catch (error) {
        console.error('getProductivityScore error:', error);
        res.status(500).json({ error: 'Failed to fetch productivity score' });
    }
};

export const getTeamProductivity = async (req, res) => {
    const orgId = req.user.org_id;
    const role = req.user.role;

    if (role !== 'orgadmin' && role !== 'manager') {
        return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }

    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || today;
    const endDate = req.query.endDate || today;

    try {
        let usersResult;
        if (role === 'manager') {
            usersResult = await query(
                `SELECT id, full_name FROM users
                 WHERE org_id = $1 AND team_id = $2 AND is_active = true`,
                [orgId, req.user.team_id]
            );
        } else {
            usersResult = await query(
                `SELECT id, full_name FROM users
                 WHERE org_id = $1 AND is_active = true`,
                [orgId]
            );
        }

        const team = [];
        for (const row of usersResult.rows) {
            const result = await calculateProductivityScore(
                row.id,
                orgId,
                startDate,
                endDate
            );
            team.push({
                userId: row.id,
                userName: row.full_name,
                score: result.score,
                breakdown: result.breakdown
            });
        }

        res.json(team);
    } catch (error) {
        console.error('getTeamProductivity error:', error);
        res.status(500).json({ error: 'Failed to fetch team productivity' });
    }
};
