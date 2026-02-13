import { query } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Daily Aggregation Job
 * Runs at midnight to aggregate previous day's app usage logs
 * into user_app_summary table for faster reporting
 */
export async function aggregateAppUsage(targetDate = null) {
    // Default to yesterday if no date provided
    const date = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Aggregation] Starting aggregation for date: ${date}`);

    try {
        // Get all organizations
        const orgs = await query('SELECT id FROM organizations WHERE is_active = true');

        for (const org of orgs.rows) {
            const orgId = org.id;

            // Get all users who have app usage logs for this date
            const users = await query(
                `SELECT DISTINCT user_id FROM app_usage_logs 
                 WHERE org_id = $1 AND log_date = $2`,
                [orgId, date]
            );

            for (const user of users.rows) {
                const userId = user.user_id;

                // Calculate category-wise totals
                const categoryStats = await query(
                    `SELECT 
                        ac.productivity_type,
                        SUM(aul.duration_seconds) as total_seconds
                     FROM app_usage_logs aul
                     JOIN tracked_apps ta ON aul.app_id = ta.id
                     LEFT JOIN app_categories ac ON ta.category_id = ac.id
                     WHERE aul.user_id = $1 AND aul.org_id = $2 AND aul.log_date = $3
                     GROUP BY ac.productivity_type`,
                    [userId, orgId, date]
                );

                let totalProductive = 0;
                let totalNonProductive = 0;
                let totalNeutral = 0;

                categoryStats.rows.forEach(row => {
                    const seconds = parseInt(row.total_seconds) || 0;
                    if (row.productivity_type === 'productive') {
                        totalProductive += seconds;
                    } else if (row.productivity_type === 'non_productive') {
                        totalNonProductive += seconds;
                    } else {
                        totalNeutral += seconds;
                    }
                });

                const totalWorking = totalProductive + totalNonProductive + totalNeutral;

                // Get category breakdown (category_id -> seconds)
                const categoryBreakdown = await query(
                    `SELECT 
                        ta.category_id,
                        ac.name as category_name,
                        SUM(aul.duration_seconds) as total_seconds
                     FROM app_usage_logs aul
                     JOIN tracked_apps ta ON aul.app_id = ta.id
                     LEFT JOIN app_categories ac ON ta.category_id = ac.id
                     WHERE aul.user_id = $1 AND aul.org_id = $2 AND aul.log_date = $3
                     GROUP BY ta.category_id, ac.name`,
                    [userId, orgId, date]
                );

                const categoryBreakdownJson = {};
                categoryBreakdown.rows.forEach(row => {
                    if (row.category_id) {
                        categoryBreakdownJson[row.category_id] = {
                            name: row.category_name,
                            seconds: parseInt(row.total_seconds)
                        };
                    }
                });

                // Get app breakdown (app_id -> seconds)
                const appBreakdown = await query(
                    `SELECT 
                        aul.app_id,
                        ta.display_name,
                        SUM(aul.duration_seconds) as total_seconds
                     FROM app_usage_logs aul
                     JOIN tracked_apps ta ON aul.app_id = ta.id
                     WHERE aul.user_id = $1 AND aul.org_id = $2 AND aul.log_date = $3
                     GROUP BY aul.app_id, ta.display_name`,
                    [userId, orgId, date]
                );

                const appBreakdownJson = {};
                appBreakdown.rows.forEach(row => {
                    appBreakdownJson[row.app_id] = {
                        name: row.display_name,
                        seconds: parseInt(row.total_seconds)
                    };
                });

                // Upsert into user_app_summary
                await query(
                    `INSERT INTO user_app_summary (
                        org_id, user_id, summary_date,
                        total_productive_seconds, total_non_productive_seconds,
                        total_neutral_seconds, total_working_seconds,
                        category_breakdown, app_breakdown
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (user_id, summary_date) DO UPDATE SET
                        total_productive_seconds = EXCLUDED.total_productive_seconds,
                        total_non_productive_seconds = EXCLUDED.total_non_productive_seconds,
                        total_neutral_seconds = EXCLUDED.total_neutral_seconds,
                        total_working_seconds = EXCLUDED.total_working_seconds,
                        category_breakdown = EXCLUDED.category_breakdown,
                        app_breakdown = EXCLUDED.app_breakdown,
                        updated_at = CURRENT_TIMESTAMP`,
                    [
                        orgId, userId, date,
                        totalProductive, totalNonProductive, totalNeutral, totalWorking,
                        JSON.stringify(categoryBreakdownJson),
                        JSON.stringify(appBreakdownJson)
                    ]
                );

                console.log(`[Aggregation] Processed user ${userId} for date ${date}`);
            }
        }

        console.log(`[Aggregation] Completed aggregation for date: ${date}`);
        return { success: true, date };
    } catch (error) {
        console.error('[Aggregation] Error:', error);
        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const targetDate = process.argv[2]; // Optional: node aggregateAppUsage.js 2026-02-12
    aggregateAppUsage(targetDate)
        .then(result => {
            console.log('Aggregation completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Aggregation failed:', error);
            process.exit(1);
        });
}
