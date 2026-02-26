import { query } from '../db.js';

export const getBreaks = async (req, res) => {
    try {
        const result = await query(
            `SELECT bm.*, bg.name as group_name 
             FROM break_master bm
             JOIN break_groups bg ON bm.break_group_id = bg.id
             WHERE bm.org_id = $1 
             ORDER BY bg.name ASC, bm.name ASC`,
            [req.user.org_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('getBreaks error:', error);
        res.status(500).json({ error: 'Failed to fetch break types' });
    }
};

export const createBreak = async (req, res) => {
    const { break_group_id, name, break_type, fixed_start_time, fixed_end_time, max_duration_minutes, daily_limit, is_paid, is_active } = req.body;

    if (!name || !break_group_id) {
        return res.status(400).json({ error: 'Break name and Break Group are required' });
    }

    // Validation
    const type = break_type === 'fixed' ? 'fixed' : 'flexible';

    try {
        const result = await query(
            `INSERT INTO break_master (org_id, break_group_id, name, break_type, fixed_start_time, fixed_end_time, max_duration_seconds, daily_limit, is_paid, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                req.user.org_id,
                break_group_id,
                name,
                type,
                type === 'fixed' ? fixed_start_time : null,
                type === 'fixed' ? fixed_end_time : null,
                max_duration_minutes ? max_duration_minutes * 60 : null,
                type === 'flexible' && daily_limit ? daily_limit : null,
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
    const { break_group_id, name, break_type, fixed_start_time, fixed_end_time, max_duration_minutes, daily_limit, is_paid, is_active } = req.body;

    try {
        // Validation
        const type = break_type === 'fixed' ? 'fixed' : 'flexible';
        const result = await query(
            `UPDATE break_master SET 
                break_group_id = COALESCE($1, break_group_id),
                name = COALESCE($2, name),
                break_type = $3,
                fixed_start_time = $4,
                fixed_end_time = $5,
                max_duration_seconds = $6,
                daily_limit = $7,
                is_paid = COALESCE($8, is_paid),
                is_active = COALESCE($9, is_active)
             WHERE id = $10 AND org_id = $11
             RETURNING *`,
            [
                break_group_id || null,
                name,
                type,
                type === 'fixed' ? fixed_start_time : null,
                type === 'fixed' ? fixed_end_time : null,
                max_duration_minutes ? max_duration_minutes * 60 : null,
                type === 'flexible' && daily_limit ? daily_limit : null,
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
        // Check if break type is referenced in break_logs
        const inUse = await query(
            'SELECT COUNT(*) as count FROM break_logs WHERE break_type_id = $1',
            [id]
        );
        if (parseInt(inUse.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete break type that has been used in logs. Deactivate it instead by setting is_active to false.'
            });
        }

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
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete break type that is still in use.' });
        }
        res.status(500).json({ error: 'Failed to delete break type' });
    }
};
