import { query } from '../db.js';

export const getBreakGroups = async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM break_groups WHERE org_id = $1 ORDER BY is_default DESC, name ASC',
            [req.user.org_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('getBreakGroups error:', error);
        res.status(500).json({ error: 'Failed to fetch break groups' });
    }
};

export const createBreakGroup = async (req, res) => {
    const { name, description, is_default } = req.body;

    if (!name) return res.status(400).json({ error: 'Group name is required' });

    try {
        // If this is the very first break group, it must be the default
        const existingCount = await query('SELECT COUNT(*) FROM break_groups WHERE org_id = $1', [req.user.org_id]);
        const shouldBeDefault = parseInt(existingCount.rows[0].count) === 0 ? true : (is_default === true);

        // If setting as default, we need to unset any existing default in a transaction
        if (shouldBeDefault) {
            await query('UPDATE break_groups SET is_default = false WHERE org_id = $1', [req.user.org_id]);
        }

        const result = await query(
            `INSERT INTO break_groups (org_id, name, description, is_default)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [req.user.org_id, name, description || null, shouldBeDefault]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('createBreakGroup error:', error);
        res.status(500).json({ error: 'Failed to create break group' });
    }
};

export const updateBreakGroup = async (req, res) => {
    const { id } = req.params;
    const { name, description, is_default } = req.body;

    try {
        if (is_default === true) {
            await query('UPDATE break_groups SET is_default = false WHERE org_id = $1', [req.user.org_id]);
        }

        const result = await query(
            `UPDATE break_groups SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                is_default = COALESCE($3, is_default)
             WHERE id = $4 AND org_id = $5
             RETURNING *`,
            [name, description, is_default, id, req.user.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Break group not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateBreakGroup error:', error);
        res.status(500).json({ error: 'Failed to update break group' });
    }
};

export const deleteBreakGroup = async (req, res) => {
    const { id } = req.params;

    try {
        // Prevent deleting if it is the default
        const groupCheck = await query('SELECT is_default FROM break_groups WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
        if (groupCheck.rows.length === 0) return res.status(404).json({ error: 'Break group not found' });

        if (groupCheck.rows[0].is_default) {
            return res.status(400).json({ error: 'Cannot delete the default break group. Please set another group as default first.' });
        }

        // Teams with this group will have break_group_id set to NULL automatically via ON DELETE SET NULL
        // break_master entries with this group will be CASCADE deleted

        const result = await query(
            'DELETE FROM break_groups WHERE id = $1 AND org_id = $2 RETURNING id',
            [id, req.user.org_id]
        );

        res.json({ message: 'Break group deleted' });
    } catch (error) {
        console.error('deleteBreakGroup error:', error);
        res.status(500).json({ error: 'Failed to delete break group' });
    }
};
