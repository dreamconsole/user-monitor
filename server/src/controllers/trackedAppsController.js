import { query } from '../db.js';

// Get all tracked apps for the organization
export const getTrackedApps = async (req, res) => {
    const orgId = req.user.org_id;
    const { unmapped } = req.query;

    try {
        let sql = `
            SELECT ta.id, ta.executable_name, ta.display_name, ta.category_id, ta.is_auto_detected,
                   ta.created_at, ta.updated_at,
                   ac.name as category_name, ac.productivity_type
            FROM tracked_apps ta
            LEFT JOIN app_categories ac ON ta.category_id = ac.id
            WHERE ta.org_id = $1
        `;

        if (unmapped === 'true') {
            sql += ` AND ta.category_id IS NULL`;
        }

        sql += ` ORDER BY ta.executable_name`;

        const result = await query(sql, [orgId]);
        res.json(result.rows);
    } catch (error) {
        console.error('getTrackedApps error:', error);
        res.status(500).json({ error: 'Failed to fetch tracked apps' });
    }
};

// Map an app to a category (Admin only)
export const mapAppToCategory = async (req, res) => {
    const orgId = req.user.org_id;
    const { id } = req.params;
    const { category_id } = req.body;

    if (!category_id) {
        return res.status(400).json({ error: 'category_id is required' });
    }

    try {
        // Verify category belongs to org
        const categoryCheck = await query(
            `SELECT id FROM app_categories WHERE id = $1 AND org_id = $2`,
            [category_id, orgId]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const result = await query(
            `UPDATE tracked_apps
             SET category_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND org_id = $3
             RETURNING id, executable_name, display_name, category_id, is_auto_detected`,
            [category_id, id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'App not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('mapAppToCategory error:', error);
        res.status(500).json({ error: 'Failed to map app to category' });
    }
};

// Manually add an app (Admin only)
export const createTrackedApp = async (req, res) => {
    const orgId = req.user.org_id;
    const { executable_name, display_name, category_id } = req.body;

    if (!executable_name) {
        return res.status(400).json({ error: 'executable_name is required' });
    }

    try {
        const result = await query(
            `INSERT INTO tracked_apps (org_id, executable_name, display_name, category_id, is_auto_detected)
             VALUES ($1, $2, $3, $4, false)
             RETURNING id, executable_name, display_name, category_id, is_auto_detected, created_at`,
            [orgId, executable_name, display_name || executable_name, category_id || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'App with this executable name already exists' });
        }
        console.error('createTrackedApp error:', error);
        res.status(500).json({ error: 'Failed to create tracked app' });
    }
};

// Update tracked app details (Admin only)
export const updateTrackedApp = async (req, res) => {
    const orgId = req.user.org_id;
    const { id } = req.params;
    const { display_name, category_id } = req.body;

    try {
        const result = await query(
            `UPDATE tracked_apps
             SET display_name = COALESCE($1, display_name),
                 category_id = COALESCE($2, category_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND org_id = $4
             RETURNING id, executable_name, display_name, category_id, is_auto_detected`,
            [display_name, category_id, id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'App not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateTrackedApp error:', error);
        res.status(500).json({ error: 'Failed to update tracked app' });
    }
};

// Delete tracked app (Admin only)
export const deleteTrackedApp = async (req, res) => {
    const orgId = req.user.org_id;
    const { id } = req.params;

    try {
        const result = await query(
            `DELETE FROM tracked_apps WHERE id = $1 AND org_id = $2 RETURNING id`,
            [id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'App not found' });
        }

        res.json({ message: 'App deleted successfully' });
    } catch (error) {
        console.error('deleteTrackedApp error:', error);
        res.status(500).json({ error: 'Failed to delete tracked app' });
    }
};
