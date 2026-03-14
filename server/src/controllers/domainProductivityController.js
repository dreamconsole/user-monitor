import { query } from '../db.js';

/**
 * GET /app-tracking/domains
 * Returns:
 *  - All saved domain rules for this org
 *  - Top domains seen in browser_activity_logs (last 30 days, no rule yet)
 *    so admins can classify them without typing manually.
 */
export const getDomains = async (req, res) => {
    const orgId = req.user.org_id;
    try {
        // 1. Saved rules (join with app_categories to get productivity_type)
        const rulesResult = await query(
            `SELECT dp.domain, dp.category_id, ac.productivity_type, ac.name as category_name, dp.created_at, dp.updated_at
             FROM domain_productivity dp
             LEFT JOIN app_categories ac ON dp.category_id = ac.id
             WHERE dp.org_id = $1
             ORDER BY dp.domain ASC`,
            [orgId]
        );

        // 2. Top domains seen recently but not yet classified
        const seenResult = await query(
            `SELECT domain, COUNT(*) as visit_count
             FROM browser_activity_logs
             WHERE org_id = $1
               AND domain IS NOT NULL
               AND domain != ''
               AND start_time >= NOW() - INTERVAL '30 days'
               AND domain NOT IN (
                   SELECT domain FROM domain_productivity WHERE org_id = $1
               )
             GROUP BY domain
             ORDER BY visit_count DESC
             LIMIT 50`,
            [orgId]
        );

        res.json({
            rules: rulesResult.rows,
            seen: seenResult.rows
        });
    } catch (error) {
        console.error('getDomains error:', error);
        res.status(500).json({ error: 'Failed to fetch domain rules' });
    }
};

/**
 * POST /app-tracking/domains
 * Body: { domain: string, category_id: uuid }
 * Upserts a domain rule for this org.
 */
export const upsertDomain = async (req, res) => {
    const orgId = req.user.org_id;
    const { domain, category_id } = req.body;

    if (!domain || !category_id) {
        return res.status(400).json({ error: 'domain and category_id are required' });
    }

    // Normalize: strip protocol, www., trailing slashes
    const normalizedDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .trim()
        .toLowerCase();

    if (!normalizedDomain) {
        return res.status(400).json({ error: 'Invalid domain' });
    }

    try {
        const result = await query(
            `INSERT INTO domain_productivity (org_id, domain, category_id, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (org_id, domain)
             DO UPDATE SET category_id = $3, updated_at = NOW()
             RETURNING *`,
            [orgId, normalizedDomain, category_id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('upsertDomain error:', error);
        res.status(500).json({ error: 'Failed to save domain rule' });
    }
};

/**
 * DELETE /app-tracking/domains/:domain
 * Removes a domain rule for this org.
 */
export const deleteDomain = async (req, res) => {
    const orgId = req.user.org_id;
    const domain = decodeURIComponent(req.params.domain);

    try {
        const result = await query(
            `DELETE FROM domain_productivity WHERE org_id = $1 AND domain = $2 RETURNING domain`,
            [orgId, domain]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Domain rule not found' });
        }

        res.json({ message: 'Domain rule deleted', domain: result.rows[0].domain });
    } catch (error) {
        console.error('deleteDomain error:', error);
        res.status(500).json({ error: 'Failed to delete domain rule' });
    }
};
