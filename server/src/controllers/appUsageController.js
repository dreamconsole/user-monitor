import { query } from '../db.js';

// Log app usage from agent
export const logAppUsage = async (req, res) => {
    const orgId = req.user.org_id;
    const userId = req.user.id;
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs) || logs.length === 0) {
        return res.status(400).json({ error: 'logs array is required' });
    }

    try {
        // Get or create work session
        const sessionResult = await query(
            `SELECT id FROM work_sessions 
             WHERE user_id = $1 AND org_id = $2 AND status = 'active' 
             ORDER BY start_time DESC LIMIT 1`,
            [userId, orgId]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(400).json({ error: 'No active work session found. Please start tracking first.' });
        }

        const sessionId = sessionResult.rows[0].id;

        // Process each log
        for (const log of logs) {
            const { executable_name, window_title, start_time, end_time, duration_seconds } = log;

            if (!executable_name || !start_time) {
                continue; // Skip invalid logs
            }

            // Get or create tracked app
            let appResult = await query(
                `SELECT id FROM tracked_apps WHERE org_id = $1 AND executable_name = $2`,
                [orgId, executable_name]
            );

            let appId;
            if (appResult.rows.length === 0) {
                // Auto-create app with Uncategorized category
                const uncategorizedResult = await query(
                    `SELECT id FROM app_categories WHERE org_id = $1 AND name = 'Uncategorized'`,
                    [orgId]
                );

                const uncategorizedId = uncategorizedResult.rows[0]?.id || null;

                const newAppResult = await query(
                    `INSERT INTO tracked_apps (org_id, executable_name, display_name, category_id, is_auto_detected)
                     VALUES ($1, $2, $2, $3, true)
                     RETURNING id`,
                    [orgId, executable_name, uncategorizedId]
                );
                appId = newAppResult.rows[0].id;
            } else {
                appId = appResult.rows[0].id;
            }

            // Insert usage log
            const logDate = new Date(start_time).toISOString().split('T')[0];
            await query(
                `INSERT INTO app_usage_logs (org_id, user_id, session_id, app_id, window_title, start_time, end_time, duration_seconds, log_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [orgId, userId, sessionId, appId, window_title, start_time, end_time, duration_seconds, logDate]
            );
        }

        res.json({ message: 'App usage logged successfully', count: logs.length });
    } catch (error) {
        console.error('logAppUsage error:', error);
        res.status(500).json({ error: 'Failed to log app usage' });
    }
};

// Get app usage for a user
export const getUserAppUsage = async (req, res) => {
    const orgId = req.user.org_id;
    const { userId } = req.params;
    const { start_date, end_date } = req.query;

    // Permission check
    if (req.user.role === 'user' && req.user.id !== userId) {
        return res.status(403).json({ error: 'Unauthorized: You can only view your own data' });
    }

    if (req.user.role === 'manager') {
        // Check if user is under this manager
        const userCheck = await query(
            `SELECT team_id FROM users WHERE id = $1 AND org_id = $2`,
            [userId, orgId]
        );

        if (userCheck.rows.length === 0 || userCheck.rows[0].team_id !== req.user.team_id) {
            return res.status(403).json({ error: 'Unauthorized: You can only view your team members' });
        }
    }

    try {
        const result = await query(
            `SELECT 
                aul.id, aul.window_title, aul.start_time, aul.end_time, aul.duration_seconds,
                ta.executable_name, ta.display_name,
                ac.name as category_name, ac.productivity_type
             FROM app_usage_logs aul
             JOIN tracked_apps ta ON aul.app_id = ta.id
             LEFT JOIN app_categories ac ON ta.category_id = ac.id
             WHERE aul.user_id = $1 AND aul.org_id = $2
             AND aul.log_date >= $3 AND aul.log_date <= $4
             ORDER BY aul.start_time DESC`,
            [userId, orgId, start_date, end_date]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('getUserAppUsage error:', error);
        res.status(500).json({ error: 'Failed to fetch app usage' });
    }
};
