import bcrypt from 'bcryptjs';
import { query } from '../db.js';

export const getUsers = async (req, res) => {
    try {
        // full_name as name, is_active as status
        // Check for active break: exists in break_logs with end_time IS NULL
        let sql = `
            SELECT 
                u.id, u.full_name as name, u.email, u.role, u.is_active, 
                u.manager_id, u.timezone, u.emp_id, u.payroll_id, u.site, 
                u.device_id, u.agent_version, u.token, u.last_heartbeat, 
                u.force_logout, u.created_at,
                u.shift_start_time, u.shift_end_time, u.shift_duration, u.work_days, u.start_of_day,
                EXISTS(SELECT 1 FROM break_logs bl WHERE bl.user_id = u.id AND bl.end_time IS NULL) as is_on_break
            FROM users u 
            WHERE u.org_id = $1
        `;
        const params = [req.user.org_id];

        if (req.user.role === 'manager') {
            sql += ' AND u.manager_id = $2';
            params.push(req.user.id);
        }

        sql += ' ORDER BY u.created_at DESC';

        const result = await query(sql, params);
        // Map is_active to status for frontend
        const users = result.rows.map(u => ({
            ...u,
            status: u.is_active ? 'active' : 'suspended'
        }));
        res.json(users);
    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ error: 'Failed to fetch users: ' + error.message });
    }
};

export const createUser = async (req, res) => {
    const {
        name, email, password, role,
        manager_id, timezone, emp_id, payroll_id, site,
        shift_start_time, shift_end_time, shift_duration, work_days, start_of_day
    } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Validate Manager (if provided)
        if (manager_id) {
            const managerCheck = await query('SELECT id FROM users WHERE id = $1 AND org_id = $2', [manager_id, req.user.org_id]);
            if (managerCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid manager selection' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (
                org_id, full_name, email, password_hash, role, 
                manager_id, timezone, emp_id, payroll_id, site,
                shift_start_time, shift_end_time, shift_duration, work_days, start_of_day
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
            RETURNING id, full_name as name, email, role, is_active, timezone, emp_id, created_at`,
            [
                req.user.org_id, name, email, hashedPassword, role,
                manager_id || null, timezone || 'UTC', emp_id || null, payroll_id || null, site || null,
                shift_start_time || null, shift_end_time || null, shift_duration || null, work_days || null, start_of_day || null
            ]
        );

        const newUser = {
            ...result.rows[0],
            status: result.rows[0].is_active ? 'active' : 'suspended'
        };
        res.status(201).json(newUser);
    } catch (error) {
        console.error('createUser error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to create user: ' + error.message });
    }
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const {
        name, role, status, manager_id, timezone, emp_id, payroll_id, site, force_logout,
        shift_start_time, shift_end_time, shift_duration, work_days, start_of_day
    } = req.body;

    try {
        // PERMISSION CHECK: If Manager, ensure they own this user
        if (req.user.role === 'manager') {
            const userCheck = await query('SELECT manager_id FROM users WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (userCheck.rows[0].manager_id !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized: You can only manage your direct reports.' });
            }
            // Prevent managers from changing roles or assigning new managers
            if (role || manager_id) {
                return res.status(403).json({ error: 'Managers cannot change user roles or reassign managers.' });
            }
        }

        // Validate Manager (if changing)
        if (manager_id) {
            const managerCheck = await query('SELECT id FROM users WHERE id = $1 AND org_id = $2', [manager_id, req.user.org_id]);
            if (managerCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid manager selection' });
            }
        }

        const isActive = status === 'active';

        const result = await query(
            `UPDATE users SET 
                full_name = COALESCE($1, full_name), 
                role = COALESCE($2, role), 
                is_active = COALESCE($3, is_active),
                manager_id = $4,
                timezone = COALESCE($5, timezone),
                emp_id = COALESCE($6, emp_id),
                payroll_id = COALESCE($7, payroll_id),
                site = COALESCE($8, site),
                force_logout = COALESCE($9, force_logout),
                shift_start_time = $10,
                shift_end_time = $11,
                shift_duration = $12,
                work_days = $13,
                start_of_day = $14
            WHERE id = $15 AND org_id = $16 
            RETURNING id, full_name as name, email, role, is_active, manager_id, timezone, emp_id, payroll_id, site, force_logout,
                shift_start_time, shift_end_time, shift_duration, work_days, start_of_day`,
            [
                name, role, isActive, manager_id || null, timezone,
                emp_id, payroll_id, site, force_logout,
                shift_start_time, shift_end_time, shift_duration, work_days, start_of_day,
                id, req.user.org_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = {
            ...result.rows[0],
            status: result.rows[0].is_active ? 'active' : 'suspended'
        };
        res.json(updatedUser);
    } catch (error) {
        console.error('updateUser error:', error);
        res.status(500).json({ error: 'Failed to update user: ' + error.message });
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query(
            'DELETE FROM users WHERE id = $1 AND org_id = $2 RETURNING id',
            [id, req.user.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('deleteUser error:', error);
        res.status(500).json({ error: 'Failed to delete user: ' + error.message });
    }
};

export const forceLogoutUser = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query(
            'UPDATE users SET force_logout = true WHERE id = $1 AND org_id = $2 RETURNING id',
            [id, req.user.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User will be forced to logout on next heartbeat' });
    } catch (error) {
        console.error('forceLogoutUser error:', error);
        res.status(500).json({ error: 'Failed to force logout user: ' + error.message });
    }
};
