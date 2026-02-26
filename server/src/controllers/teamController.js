import { query } from '../db.js';

export const getTeams = async (req, res) => {
    try {
        let sql = `
            SELECT t.id, t.name, t.description, t.max_members, t.created_at,
                   COUNT(u.id) as total_members,
                   (
                       SELECT json_agg(json_build_object('id', m.id, 'name', m.full_name, 'email', m.email, 'role', m.role))
                       FROM users m WHERE m.team_id = t.id AND m.role = 'manager'
                   ) as managers
            FROM teams t
            LEFT JOIN users u ON u.team_id = t.id
            WHERE t.org_id = $1
        `;
        const params = [req.user.org_id];

        if (req.user.role === 'manager') {
            sql += ` AND t.id = $2`;
            params.push(req.user.team_id);
        }

        sql += ` GROUP BY t.id ORDER BY t.name ASC`;

        const result = await query(sql, params);

        // Ensure managers is at least an empty array instead of null
        const teams = result.rows.map(team => ({
            ...team,
            managers: team.managers || []
        }));

        res.json(teams);
    } catch (error) {
        console.error('getTeams error:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
};

export const createTeam = async (req, res) => {
    if (req.user.role !== 'orgadmin') {
        return res.status(403).json({ error: 'Only administrators can create teams' });
    }

    const { name, description, max_members } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name is required' });

    try {
        const result = await query(
            'INSERT INTO teams (org_id, name, description, max_members) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.user.org_id, name, description || null, max_members || null]
        );
        res.status(201).json({ ...result.rows[0], total_members: 0, managers: [] });
    } catch (error) {
        console.error('createTeam error:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
};

export const updateTeam = async (req, res) => {
    if (req.user.role !== 'orgadmin') {
        return res.status(403).json({ error: 'Only administrators can update teams' });
    }

    const { id } = req.params;
    const { name, description, max_members } = req.body;

    try {
        const result = await query(
            'UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description), max_members = $3 WHERE id = $4 AND org_id = $5 RETURNING *',
            [name, description, max_members || null, id, req.user.org_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateTeam error:', error);
        res.status(500).json({ error: 'Failed to update team' });
    }
};

export const deleteTeam = async (req, res) => {
    if (req.user.role !== 'orgadmin') {
        return res.status(403).json({ error: 'Only administrators can delete teams' });
    }

    const { id } = req.params;

    try {
        const result = await query(
            'DELETE FROM teams WHERE id = $1 AND org_id = $2 RETURNING id',
            [id, req.user.org_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('deleteTeam error:', error);
        res.status(500).json({ error: 'Failed to delete team' });
    }
};

export const getTeamMembers = async (req, res) => {
    const { id } = req.params;

    try {
        if (req.user.role === 'manager' && req.user.team_id !== id) {
            return res.status(403).json({ error: 'You can only view members of your assigned team' });
        }

        const result = await query(
            'SELECT id, full_name as name, email, role, is_active as status FROM users WHERE team_id = $1 AND org_id = $2 ORDER BY role ASC, full_name ASC',
            [id, req.user.org_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('getTeamMembers error:', error);
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
};

// Add members to team
export const addMembers = async (req, res) => {
    if (req.user.role !== 'orgadmin') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { userIds } = req.body; // Array of UUIDs

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds array is required' });
    }

    try {
        // Enforce max members rule
        const teamCheck = await query('SELECT max_members FROM teams WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
        if (teamCheck.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

        const maxMembers = teamCheck.rows[0].max_members;

        if (maxMembers) {
            const currentMembersCount = await query('SELECT COUNT(*) FROM users WHERE team_id = $1 AND org_id = $2 AND role != $3', [id, req.user.org_id, 'manager']);
            const newMembersLength = userIds.length;
            const totalEst = parseInt(currentMembersCount.rows[0].count) + newMembersLength;
            if (totalEst > maxMembers) {
                return res.status(400).json({ error: `This team has a limit of ${maxMembers} members. Adding these users would exceed the limit.` });
            }
        }

        // Enforce max 2 managers rule
        // 1. Get current managers on the team
        const currentManagersRes = await query(
            'SELECT id FROM users WHERE team_id = $1 AND role = $2 AND org_id = $3',
            [id, 'manager', req.user.org_id]
        );
        const currentManagers = currentManagersRes.rows.map(r => r.id);

        // 2. Check how many of the NEW userIds are managers
        const newUsersRes = await query(
            'SELECT id, role FROM users WHERE id = ANY($1) AND org_id = $2',
            [userIds, req.user.org_id]
        );

        const newManagers = newUsersRes.rows.filter(u => u.role === 'manager' && !currentManagers.includes(u.id));

        if (currentManagers.length + newManagers.length > 2) {
            return res.status(400).json({ error: `A team can have a maximum of 2 managers. Adding these users would exceed the limit.` });
        }

        await query(
            'UPDATE users SET team_id = $1 WHERE id = ANY($2) AND org_id = $3',
            [id, userIds, req.user.org_id]
        );

        res.json({ message: 'Members added successfully' });
    } catch (error) {
        console.error('addMembers error:', error);
        res.status(500).json({ error: 'Failed to add members to team' });
    }
};

export const removeMember = async (req, res) => {
    if (req.user.role !== 'orgadmin') return res.status(403).json({ error: 'Forbidden' });

    const { id, userId } = req.params;

    try {
        await query(
            'UPDATE users SET team_id = NULL WHERE id = $1 AND team_id = $2 AND org_id = $3',
            [userId, id, req.user.org_id]
        );
        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('removeMember error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};
