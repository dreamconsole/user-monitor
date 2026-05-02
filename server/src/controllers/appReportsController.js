import { query } from '../db.js';
import { managerCanAccessTeamMember, getManagerTeamIds } from '../utils/managerTeamAccess.js';

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
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    try {
        const teamIds = await getManagerTeamIds(req.user.id, orgId);
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
             AND u.team_id = ANY($2::uuid[])
             AND u.role != 'orgadmin'
             AND uas.summary_date >= $3 AND uas.summary_date <= $4
             GROUP BY uas.user_id, u.full_name, u.email
             ORDER BY total_working_seconds DESC`,
            [orgId, teamIds, start_date, end_date]
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

        // TLD-stripping regex
        const tldRegex = '\\.[a-z]{2,6}(\\.[a-z]{2,3})?$';
        const browserExclusion = `LOWER(ta.executable_name) NOT IN ('chrome.exe', 'msedge.exe', 'brave.exe', 'opera.exe', 'firefox.exe', 'vivaldi.exe', 'arc.exe', 'chromium.exe', 'waterfox.exe', 'librewolf.exe', 'duckduckgo.exe', 'whale.exe', 'browser.exe', 'maxthon.exe', 'samsung internet', 'chrome', 'msedge', 'firefox')`;

        const uncatResult = await query(
            `SELECT name, productivity_type FROM app_categories WHERE org_id = $1 AND name = 'Uncategorized' LIMIT 1`,
            [orgId]
        );
        const uncatCategory = uncatResult.rows[0] || { name: 'Uncategorized', productivity_type: 'neutral' };

        let liveProductivity;
        try {
            liveProductivity = await query(
                `WITH app_stats AS (
                    SELECT 
                        ac.productivity_type,
                        SUM(aul.duration_seconds) as total_seconds
                    FROM app_usage_logs aul
                    JOIN tracked_apps ta ON aul.app_id = ta.id
                    LEFT JOIN app_categories ac ON ta.category_id = ac.id
                    WHERE aul.user_id = $1 AND aul.org_id = $2
                    AND aul.log_date >= $3 AND aul.log_date <= $4
                    AND ${browserExclusion}
                    GROUP BY ac.productivity_type
                 ),
                 browser_stats AS (
                     SELECT 
                         COALESCE(matched_dp.productivity_type, $5) as productivity_type,
                         SUM(bal.duration_seconds) as total_seconds
                     FROM browser_activity_logs bal
                     LEFT JOIN LATERAL (
                         SELECT ac.productivity_type
                         FROM domain_productivity dp
                         LEFT JOIN app_categories ac ON dp.category_id = ac.id
                         WHERE dp.org_id = $2
                           AND LENGTH(dp.domain) > 2
                           AND (
                                 (bal.domain IS NOT NULL AND bal.domain != '' AND LOWER(bal.domain) LIKE '%' || LOWER(dp.domain) || '%')
                              OR (bal.domain IS NOT NULL AND bal.domain != '' AND LOWER(dp.domain) LIKE '%' || LOWER(bal.domain) || '%')
                              OR (LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(dp.domain) || '%')
                              OR (LENGTH(REGEXP_REPLACE(dp.domain, '` + tldRegex + `', '')) > 2
                                  AND LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(REGEXP_REPLACE(dp.domain, '` + tldRegex + `', '')) || '%')
                           )
                         ORDER BY
                             CASE WHEN bal.domain IS NOT NULL AND LOWER(bal.domain) = LOWER(dp.domain) THEN 0
                                  WHEN bal.domain IS NOT NULL AND LOWER(bal.domain) LIKE '%' || LOWER(dp.domain) || '%' THEN 1
                                  WHEN LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(dp.domain) || '%' THEN 2
                                  ELSE 3 END,
                             LENGTH(dp.domain) DESC
                         LIMIT 1
                     ) matched_dp ON TRUE
                     WHERE bal.user_id = $1 AND bal.org_id = $2
                     AND bal.start_time::date >= $3::date AND bal.start_time::date <= $4::date
                     GROUP BY COALESCE(matched_dp.productivity_type, $5)
                 )
                 SELECT productivity_type, SUM(total_seconds) as total_seconds
                 FROM (
                     SELECT * FROM app_stats
                     UNION ALL
                     SELECT * FROM browser_stats
                 ) combined
                 GROUP BY productivity_type`,
                [userId, orgId, start_date, end_date, uncatCategory.productivity_type]
            );
        } catch (err) {
            if (err?.code === '42P01') {
                // Fallback if browser_activity_logs doesn't exist
                liveProductivity = await query(
                    `SELECT 
                        ac.productivity_type,
                        SUM(aul.duration_seconds) as total_seconds
                     FROM app_usage_logs aul
                     JOIN tracked_apps ta ON aul.app_id = ta.id
                     LEFT JOIN app_categories ac ON ta.category_id = ac.id
                     WHERE aul.user_id = $1 AND aul.org_id = $2
                     AND aul.log_date >= $3 AND aul.log_date <= $4
                     GROUP BY ac.productivity_type`,
                    [userId, orgId, start_date, end_date]
                );
            } else {
                throw err;
            }
        }

        res.json({
            summary: summary.rows,
            top_apps: topApps.rows,
            live_summary: liveProductivity.rows
        });
    } catch (error) {
        console.error('getUserDashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch user dashboard' });
    }
};

// Browser activity details -- domain breakdown for a user
export const getBrowserActivityDetails = async (req, res) => {
    const orgId = req.user.org_id;
    const { userId } = req.params;
    const { start_date, end_date, browser } = req.query;

    if (req.user.role === 'user' && String(req.user.id) !== String(userId)) {
        return res.status(403).json({ error: 'Unauthorized: You can only view your own data' });
    }

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    try {
        const hasSourceColumnResult = await query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'browser_activity_logs'
               AND column_name = 'source'
             LIMIT 1`
        );
        const hasSourceColumn = hasSourceColumnResult.rows.length > 0;

        const params = [userId, orgId, start_date, end_date];
        let browserFilter = '';
        if (browser) {
            browserFilter = ' AND LOWER(bal.browser) = LOWER($5)';
            params.push(browser);
        }

        const sourceSelect = hasSourceColumn ? 'bal.source' : `'extension'::text as source`;
        const sourceGroupBy = hasSourceColumn ? ', bal.source' : '';
        const summarySourceSelect = hasSourceColumn ? 'MAX(bal.source) as source' : `'extension'::text as source`;

        // TLD-stripping regex: removes .com, .net, .co.uk style TLDs
        // Written as a plain string (not template literal) to avoid JS template interpolation of $
        const tldRegex = '\\.[a-z]{2,6}(\\.[a-z]{2,3})?$';

        // Fetch the org's Uncategorized category so we can fall back to its productivity_type
        // for browser domains that have no matching domain_productivity rule.
        const uncatResult = await query(
            `SELECT name, productivity_type FROM app_categories WHERE org_id = $1 AND name = 'Uncategorized' LIMIT 1`,
            [orgId]
        );
        const uncatCategory = uncatResult.rows[0] || { name: 'Uncategorized', productivity_type: 'neutral' };

        const domainBreakdown = await query(
            `SELECT 
                COALESCE(bal.domain, bal.title) as domain,
                bal.browser,
                ${sourceSelect},
                COUNT(*) as visit_count,
                SUM(bal.duration_seconds) as total_seconds,
                MAX(bal.title) as last_title,
                COALESCE(matched_dp.category_name, $${params.length + 1}) as category_name,
                COALESCE(matched_dp.productivity_type, $${params.length + 2}) as productivity_type
             FROM browser_activity_logs bal
             LEFT JOIN LATERAL (
                 SELECT dp.category_id, ac.name as category_name, ac.productivity_type
                 FROM domain_productivity dp
                 LEFT JOIN app_categories ac ON dp.category_id = ac.id
                 WHERE dp.org_id = $2
                   AND LENGTH(dp.domain) > 2
                   AND (
                         (bal.domain IS NOT NULL AND bal.domain != '' AND LOWER(bal.domain) LIKE '%' || LOWER(dp.domain) || '%')
                      OR (bal.domain IS NOT NULL AND bal.domain != '' AND LOWER(dp.domain) LIKE '%' || LOWER(bal.domain) || '%')
                      OR (LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(dp.domain) || '%')
                      OR (LENGTH(REGEXP_REPLACE(dp.domain, '` + tldRegex + `', '')) > 2
                          AND LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(REGEXP_REPLACE(dp.domain, '` + tldRegex + `', '')) || '%')
                   )
                 ORDER BY
                     CASE WHEN bal.domain IS NOT NULL AND LOWER(bal.domain) = LOWER(dp.domain) THEN 0
                          WHEN bal.domain IS NOT NULL AND LOWER(bal.domain) LIKE '%' || LOWER(dp.domain) || '%' THEN 1
                          WHEN LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(dp.domain) || '%' THEN 2
                          ELSE 3 END,
                     LENGTH(dp.domain) DESC
                 LIMIT 1
             ) matched_dp ON TRUE
             WHERE bal.user_id = $1 AND bal.org_id = $2
             AND bal.start_time::date >= $3::date AND bal.start_time::date <= $4::date
             ${browserFilter}
             GROUP BY COALESCE(bal.domain, bal.title), bal.browser${sourceGroupBy}, matched_dp.category_name, matched_dp.productivity_type
             ORDER BY total_seconds DESC
             LIMIT 50`,
            [...params, uncatCategory.name, uncatCategory.productivity_type]
        );

        const browserSummary = await query(
            `SELECT 
                bal.browser,
                COUNT(DISTINCT COALESCE(bal.domain, bal.title)) as unique_domains,
                SUM(bal.duration_seconds) as total_seconds,
                ${summarySourceSelect}
             FROM browser_activity_logs bal
             WHERE bal.user_id = $1 AND bal.org_id = $2
             AND bal.start_time::date >= $3::date AND bal.start_time::date <= $4::date
             GROUP BY bal.browser
             ORDER BY total_seconds DESC`,
            [userId, orgId, start_date, end_date]
        );

        res.json({
            domains: domainBreakdown.rows,
            browsers: browserSummary.rows
        });
    } catch (error) {
        // Gracefully handle environments where browser activity table is not migrated yet.
        if (error?.code === '42P01') {
            return res.json({ domains: [], browsers: [] });
        }
        console.error('getBrowserActivityDetails error:', error);
        res.status(500).json({ error: 'Failed to fetch browser activity details' });
    }
};

// Productivity summary with category breakdown
export const getProductivitySummary = async (req, res) => {
    const orgId = req.user.org_id;
    const { userId } = req.params;
    const { start_date, end_date } = req.query;

    // Permission check
    if (req.user.role === 'user' && String(req.user.id) !== String(userId)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'manager') {
        const may = await managerCanAccessTeamMember(req.user.id, orgId, userId);
        if (!may) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
    }

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    try {
        // TLD-stripping regex
        const tldRegex = '\\.[a-z]{2,6}(\\.[a-z]{2,3})?$';
        const browserExclusion = `LOWER(ta.executable_name) NOT IN ('chrome.exe', 'msedge.exe', 'brave.exe', 'opera.exe', 'firefox.exe', 'vivaldi.exe', 'arc.exe', 'chromium.exe', 'waterfox.exe', 'librewolf.exe', 'duckduckgo.exe', 'whale.exe', 'browser.exe', 'maxthon.exe', 'samsung internet', 'chrome', 'msedge', 'firefox')`;

        const uncatResult = await query(
            `SELECT name, productivity_type FROM app_categories WHERE org_id = $1 AND name = 'Uncategorized' LIMIT 1`,
            [orgId]
        );
        const uncatCategory = uncatResult.rows[0] || { name: 'Uncategorized', productivity_type: 'neutral' };

        let result;
        try {
            // Get category-wise breakdown (blended apps and browser domains)
            result = await query(
                `WITH app_stats AS (
                    SELECT 
                        ac.name as category_name,
                        ac.productivity_type,
                        SUM(aul.duration_seconds) as total_seconds
                    FROM app_usage_logs aul
                    JOIN tracked_apps ta ON aul.app_id = ta.id
                    LEFT JOIN app_categories ac ON ta.category_id = ac.id
                    WHERE aul.user_id = $1 AND aul.org_id = $2
                    AND aul.log_date >= $3 AND aul.log_date <= $4
                    AND ${browserExclusion}
                    GROUP BY ac.id, ac.name, ac.productivity_type
                 ),
                 browser_stats AS (
                     SELECT 
                         COALESCE(matched_dp.category_name, $5) as category_name,
                         COALESCE(matched_dp.productivity_type, $6) as productivity_type,
                         SUM(bal.duration_seconds) as total_seconds
                     FROM browser_activity_logs bal
                     LEFT JOIN LATERAL (
                         SELECT ac.name as category_name, ac.productivity_type
                         FROM domain_productivity dp
                         LEFT JOIN app_categories ac ON dp.category_id = ac.id
                         WHERE dp.org_id = $2
                           AND LENGTH(dp.domain) > 2
                           AND (
                                 (bal.domain IS NOT NULL AND bal.domain != '' AND LOWER(bal.domain) LIKE '%' || LOWER(dp.domain) || '%')
                              OR (bal.domain IS NOT NULL AND bal.domain != '' AND LOWER(dp.domain) LIKE '%' || LOWER(bal.domain) || '%')
                              OR (LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(dp.domain) || '%')
                              OR (LENGTH(REGEXP_REPLACE(dp.domain, '` + tldRegex + `', '')) > 2
                                  AND LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(REGEXP_REPLACE(dp.domain, '` + tldRegex + `', '')) || '%')
                           )
                         ORDER BY
                             CASE WHEN bal.domain IS NOT NULL AND LOWER(bal.domain) = LOWER(dp.domain) THEN 0
                                  WHEN bal.domain IS NOT NULL AND LOWER(bal.domain) LIKE '%' || LOWER(dp.domain) || '%' THEN 1
                                  WHEN LOWER(COALESCE(bal.title, '')) LIKE '%' || LOWER(dp.domain) || '%' THEN 2
                                  ELSE 3 END,
                             LENGTH(dp.domain) DESC
                         LIMIT 1
                     ) matched_dp ON TRUE
                     WHERE bal.user_id = $1 AND bal.org_id = $2
                     AND bal.start_time::date >= $3::date AND bal.start_time::date <= $4::date
                     GROUP BY COALESCE(matched_dp.category_name, $5), COALESCE(matched_dp.productivity_type, $6)
                 )
                 SELECT category_name, productivity_type, SUM(total_seconds) as total_seconds
                 FROM (
                     SELECT * FROM app_stats
                     UNION ALL
                     SELECT * FROM browser_stats
                 ) combined
                 GROUP BY category_name, productivity_type
                 ORDER BY total_seconds DESC`,
                [userId, orgId, start_date, end_date, uncatCategory.name, uncatCategory.productivity_type]
            );
        } catch (err) {
            if (err?.code === '42P01') {
                // Fallback if browser_activity_logs doesn't exist
                result = await query(
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
            } else {
                throw err;
            }
        }

        res.json(result.rows);
    } catch (error) {
        console.error('getProductivitySummary error:', error);
        res.status(500).json({ error: 'Failed to fetch productivity summary' });
    }
};
