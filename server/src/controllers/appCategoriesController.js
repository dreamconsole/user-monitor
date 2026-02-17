import { query } from '../db.js';

// Get all app categories for the organization
export const getAppCategories = async (req, res) => {
    const orgId = req.user.org_id;

    try {
        const result = await query(
            `SELECT id, name, productivity_type, description, is_active, created_at, updated_at
             FROM app_categories
             WHERE org_id = $1 AND is_active = true
             ORDER BY name`,
            [orgId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('getAppCategories error:', error);
        res.status(500).json({ error: 'Failed to fetch app categories' });
    }
};

// Create a new app category (Admin only)
export const createAppCategory = async (req, res) => {
    const orgId = req.user.org_id;
    const { name, productivity_type, description } = req.body;

    if (!name || !productivity_type) {
        return res.status(400).json({ error: 'Name and productivity_type are required' });
    }

    if (!['productive', 'non_productive', 'neutral'].includes(productivity_type)) {
        return res.status(400).json({ error: 'Invalid productivity_type. Must be: productive, non_productive, or neutral' });
    }

    try {
        const result = await query(
            `INSERT INTO app_categories (org_id, name, productivity_type, description)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, productivity_type, description, is_active, created_at, updated_at`,
            [orgId, name, productivity_type, description || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Category with this name already exists' });
        }
        console.error('createAppCategory error:', error);
        res.status(500).json({ error: 'Failed to create app category' });
    }
};

// Update an app category (Admin only)
export const updateAppCategory = async (req, res) => {
    const orgId = req.user.org_id;
    const { id } = req.params;
    const { name, productivity_type, description, is_active } = req.body;

    if (productivity_type && !['productive', 'non_productive', 'neutral'].includes(productivity_type)) {
        return res.status(400).json({ error: 'Invalid productivity_type' });
    }

    try {
        const result = await query(
            `UPDATE app_categories
             SET name = COALESCE($1, name),
                 productivity_type = COALESCE($2, productivity_type),
                 description = COALESCE($3, description),
                 is_active = COALESCE($4, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 AND org_id = $6
             RETURNING id, name, productivity_type, description, is_active, created_at, updated_at`,
            [name, productivity_type, description, is_active, id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Category with this name already exists' });
        }
        console.error('updateAppCategory error:', error);
        res.status(500).json({ error: 'Failed to update app category' });
    }
};

// Delete an app category (Admin only)
export const deleteAppCategory = async (req, res) => {
    const orgId = req.user.org_id;
    const { id } = req.params;

    try {
        // Check if category is in use
        const inUse = await query(
            `SELECT COUNT(*) as count FROM tracked_apps WHERE category_id = $1`,
            [id]
        );

        if (parseInt(inUse.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete category that is assigned to apps. Please reassign or remove apps first.'
            });
        }

        const result = await query(
            `DELETE FROM app_categories WHERE id = $1 AND org_id = $2 RETURNING id`,
            [id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('deleteAppCategory error:', error);
        res.status(500).json({ error: 'Failed to delete app category' });
    }
};
