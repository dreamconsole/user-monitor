import { query } from '../db.js';

// Admin dashboard - all users app usage summary
export const getAdminDashboard = async (req, res) => {
    const orgId = req.user.org_id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    try {
        // Get summary for all users
        const result = await query(
            `SELECT 
                uas.user_id,
                u.full_name as user_name,
                u.email,
                SUM(uas.total_productive_seconds) as total_productive_seconds,
                SUM(uas.total_non_productive_seconds) as total_non_productive_seconds,
                SUM(uas.total_neutral_seconds) as total_neutral_seconds,
                SUM(uas.total_working_seconds) as total_working_seconds
             FROM user_app_summary uas
             JOIN users u ON uas.user_id = u.id
             WHERE uas.org_id = $1 AND uas.summary_date >= $2 AND uas.summary_date <= $3
             GROUP BY uas.user_id, u.full_name, u.email
             ORDER BY total_working_seconds DESC`,
            [orgId, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('getAdminDashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch admin dashboard' });
    }
};

// Manager dashboard - team members only
export const getManagerDashboard = async (req, res) => {
    const orgId = req.user.org_id;
    const managerId = req.user.id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    try {
        const result = await query(
            `SELECT 
                uas.user_id,
                u.full_name as user_name,
                u.email,
                SUM(uas.total_productive_seconds) as total_productive_seconds,
                SUM(uas.total_non_productive_seconds) as total_non_productive_seconds,
                SUM(uas.total_neutral_seconds) as total_neutral_seconds,
                SUM(uas.total_working_seconds) as total_working_seconds
             FROM user_app_summary uas
             JOIN users u ON uas.user_id = u.id
             WHERE uas.org_id = $1 
             AND u.manager_id = $2
             AND uas.summary_date >= $3 AND uas.summary_date <= $4
             GROUP BY uas.user_id, u.full_name, u.email
             ORDER BY total_working_seconds DESC`,
            [orgId, managerId, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('getManagerDashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch manager dashboard' });
    }
};

// User dashboard - self only
export const getUserDashboard = async (req, res) => {
    const orgId = req.user.org_id;
    const { userId } = req.params;
    const { start_date, end_date } = req.query;

    // Permission check
    if (req.user.role === 'user' && req.user.id !== userId) {
        return res.status(403).json({ error: 'Unauthorized: You can only view your own data' });
    }

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    try {
        // Get daily summary
        const summary = await query(
            `SELECT 
                summary_date,
                total_productive_seconds,
                total_non_productive_seconds,
                total_neutral_seconds,
                total_working_seconds,
                category_breakdown,
                app_breakdown
             FROM user_app_summary
             WHERE user_id = $1 AND org_id = $2 
             AND summary_date >= $3 AND summary_date <= $4
             ORDER BY summary_date DESC`,
            [userId, orgId, start_date, end_date]
        );

        // Get top apps
        const topApps = await query(
            `SELECT 
                ta.display_name,
                ta.executable_name,
                ac.name as category_name,
                ac.productivity_type,
                SUM(aul.duration_seconds) as total_seconds
             FROM app_usage_logs aul
             JOIN tracked_apps ta ON aul.app_id = ta.id
             LEFT JOIN app_categories ac ON ta.category_id = ac.id
             WHERE aul.user_id = $1 AND aul.org_id = $2
             AND aul.log_date >= $3 AND aul.log_date <= $4
             GROUP BY ta.id, ta.display_name, ta.executable_name, ac.name, ac.productivity_type
             ORDER BY total_seconds DESC
             LIMIT 10`,
            [userId, orgId, start_date, end_date]
        );

        res.json({
            summary: summary.rows,
            top_apps: topApps.rows
        });
    } catch (error) {
        console.error('getUserDashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch user dashboard' });
    }
};

// Productivity summary with category breakdown
export const getProductivitySummary = async (req, res) => {
    const orgId = req.user.org_id;
    const { userId } = req.params;
    const { start_date, end_date } = req.query;

    // Permission check
    if (req.user.role === 'user' && req.user.id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'manager') {
        const userCheck = await query(
            `SELECT manager_id FROM users WHERE id = $1 AND org_id = $2`,
            [userId, orgId]
        );
        if (userCheck.rows.length === 0 || userCheck.rows[0].manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
    }

    try {
        // Get category-wise breakdown
        const result = await query(
            `SELECT 
                ac.name as category_name,
                ac.productivity_type,
                SUM(aul.duration_seconds) as total_seconds
             FROM app_usage_logs aul
             JOIN tracked_apps ta ON aul.app_id = ta.id
             LEFT JOIN app_categories ac ON ta.category_id = ac.id
             WHERE aul.user_id = $1 AND aul.org_id = $2
             AND aul.log_date >= $3 AND aul.log_date <= $4
             GROUP BY ac.id, ac.name, ac.productivity_type
             ORDER BY total_seconds DESC`,
            [userId, orgId, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('getProductivitySummary error:', error);
        res.status(500).json({ error: 'Failed to fetch productivity summary' });
    }
};
