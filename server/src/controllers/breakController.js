import { query } from '../db.js';

export const getBreaks = async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM break_master WHERE org_id = $1 ORDER BY name ASC',
            [req.user.org_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('getBreaks error:', error);
        res.status(500).json({ error: 'Failed to fetch break types' });
    }
};

export const createBreak = async (req, res) => {
    const { name, max_duration_minutes, is_paid, is_active } = req.body;

    if (!name) return res.status(400).json({ error: 'Break name is required' });

    try {
        const result = await query(
            `INSERT INTO break_master (org_id, name, max_duration_seconds, is_paid, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                req.user.org_id,
                name,
                max_duration_minutes ? max_duration_minutes * 60 : null,
                is_paid ?? false,
                is_active ?? true
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('createBreak error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'A break with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to create break type' });
    }
};

export const updateBreak = async (req, res) => {
    const { id } = req.params;
    const { name, max_duration_minutes, is_paid, is_active } = req.body;

    try {
        const result = await query(
            `UPDATE break_master SET 
                name = COALESCE($1, name),
                max_duration_seconds = $2,
                is_paid = COALESCE($3, is_paid),
                is_active = COALESCE($4, is_active)
             WHERE id = $5 AND org_id = $6
             RETURNING *`,
            [
                name,
                max_duration_minutes ? max_duration_minutes * 60 : null,
                is_paid,
                is_active,
                id,
                req.user.org_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Break type not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateBreak error:', error);
        res.status(500).json({ error: 'Failed to update break type' });
    }
};

export const deleteBreak = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query(
            'DELETE FROM break_master WHERE id = $1 AND org_id = $2 RETURNING id',
            [id, req.user.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Break type not found' });
        }
        res.json({ message: 'Break type deleted' });
    } catch (error) {
        console.error('deleteBreak error:', error);
        res.status(500).json({ error: 'Failed to delete break type' });
    }
};
