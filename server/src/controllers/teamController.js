import { query } from '../db.js';
import { managerCanAccessTeam } from '../utils/managerTeamAccess.js';

export const getTeams = async (req, res) => {
    try {
        let sql = `
            SELECT t.id, t.name, t.description, t.max_members, t.break_group_id, t.created_at,
                   bg.name as break_group_name,
                   (
                       SELECT COUNT(DISTINCT uid)::int FROM (
                           SELECT u.id AS uid FROM users u
                           WHERE u.team_id = t.id AND u.org_id = t.org_id AND u.is_active = true
                           UNION
                           SELECT tml.user_id FROM team_manager_links tml
                           JOIN users u ON u.id = tml.user_id AND u.org_id = t.org_id
                           WHERE tml.team_id = t.id AND u.is_active = true
                       ) x
                   ) AS total_members,
                   (
                       SELECT COALESCE(json_agg(
                           json_build_object('id', x.id, 'name', x.full_name, 'email', x.email, 'role', x.role)
                       ), '[]'::json)
                       FROM (
                           SELECT DISTINCT u.id, u.full_name, u.email, u.role
                           FROM (
                               SELECT u.id, u.full_name, u.email, u.role
                               FROM users u
                               WHERE u.team_id = t.id AND u.org_id = t.org_id
                                 AND u.role IN ('manager', 'orgadmin') AND u.is_active = true
                               UNION
                               SELECT u.id, u.full_name, u.email, u.role
                               FROM team_manager_links tml
                               JOIN users u ON u.id = tml.user_id AND u.org_id = t.org_id
                               WHERE tml.team_id = t.id
                                 AND u.role IN ('manager', 'orgadmin') AND u.is_active = true
                           ) u
                       ) x
                   ) AS managers
            FROM teams t
            LEFT JOIN break_groups bg ON t.break_group_id = bg.id
            WHERE t.org_id = $1
        `;
        const params = [req.user.org_id];

        if (req.user.role === 'manager') {
            sql += ` AND (
                EXISTS (SELECT 1 FROM users mu WHERE mu.id = $2 AND mu.org_id = t.org_id AND mu.team_id = t.id)
                OR t.id IN (SELECT team_id FROM team_manager_links WHERE user_id = $2)
            )`;
            params.push(req.user.id);
        }

        sql += ` ORDER BY t.name ASC`;

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

    const { name, description, max_members, break_group_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name is required' });

    try {
        const result = await query(
            'INSERT INTO teams (org_id, name, description, max_members, break_group_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.user.org_id, name, description || null, max_members || null, break_group_id || null]
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
    const { name, description, max_members, break_group_id } = req.body;

    try {
        const result = await query(
            'UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description), max_members = $3, break_group_id = $4 WHERE id = $5 AND org_id = $6 RETURNING *',
            [name, description, max_members || null, break_group_id || null, id, req.user.org_id]
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
        if (req.user.role === 'manager') {
            const allowed = await managerCanAccessTeam(req.user.id, req.user.org_id, id);
            if (!allowed) {
                return res.status(403).json({ error: 'You can only view members of teams you manage' });
            }
        }

        const result = await query(
            `SELECT id, full_name as name, email, role, is_active as status
             FROM users
             WHERE org_id = $2 AND is_active = true
               AND (
                 team_id = $1
                 OR id IN (SELECT user_id FROM team_manager_links WHERE team_id = $1)
               )
             ORDER BY role ASC, full_name ASC`,
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
    const userIds = req.body.userIds || req.body.user_ids; // Array of UUIDs

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds (or user_ids) array is required' });
    }

    try {
        // Enforce max members rule
        const teamCheck = await query('SELECT max_members FROM teams WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
        if (teamCheck.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

        const maxMembers = teamCheck.rows[0].max_members;

        const newUsersRes = await query(
            'SELECT id, role FROM users WHERE id = ANY($1) AND org_id = $2',
            [userIds, req.user.org_id]
        );
        if (newUsersRes.rows.length !== userIds.length) {
            return res.status(400).json({ error: 'One or more users were not found in your organization' });
        }

        const memberRows = newUsersRes.rows.filter(u => u.role === 'user');
        const leaderRows = newUsersRes.rows.filter(u => u.role === 'manager' || u.role === 'orgadmin');

        if (maxMembers && memberRows.length > 0) {
            const currentMembersCount = await query(
                `SELECT COUNT(*)::int AS c FROM users WHERE team_id = $1 AND org_id = $2 AND role = 'user' AND is_active = true`,
                [id, req.user.org_id]
            );
            const totalEst = parseInt(currentMembersCount.rows[0].c, 10) + memberRows.length;
            if (totalEst > maxMembers) {
                return res.status(400).json({ error: `This team has a limit of ${maxMembers} members. Adding these users would exceed the limit.` });
            }
        }

        const leadersOnTeamRes = await query(
            `SELECT COUNT(DISTINCT x.uid)::int AS c FROM (
                SELECT u.id AS uid FROM users u
                WHERE u.team_id = $1 AND u.org_id = $2 AND u.role IN ('manager','orgadmin') AND u.is_active = true
                UNION
                SELECT tml.user_id FROM team_manager_links tml
                JOIN users u ON u.id = tml.user_id AND u.org_id = $2
                WHERE tml.team_id = $1 AND u.role IN ('manager','orgadmin') AND u.is_active = true
            ) x`,
            [id, req.user.org_id]
        );
        const leadersOnTeam = leadersOnTeamRes.rows[0].c;

        const existingLeaderIdsRes = await query(
            `SELECT u.id FROM users u
             WHERE u.org_id = $2 AND u.id = ANY($1::uuid[]) AND (
               u.team_id = $3 OR EXISTS (SELECT 1 FROM team_manager_links tml WHERE tml.team_id = $3 AND tml.user_id = u.id)
             )`,
            [leaderRows.map(r => r.id), req.user.org_id, id]
        );
        const existingLeaderIds = new Set(existingLeaderIdsRes.rows.map(r => r.id));
        const newLeaders = leaderRows.filter(r => !existingLeaderIds.has(r.id));

        if (leadersOnTeam + newLeaders.length > 2) {
            return res.status(400).json({ error: 'A team can have a maximum of 2 managers (including org admins assigned to the team).' });
        }

        if (memberRows.length > 0) {
            await query(
                'UPDATE users SET team_id = $1 WHERE id = ANY($2::uuid[]) AND org_id = $3 AND role = $4',
                [id, memberRows.map(r => r.id), req.user.org_id, 'user']
            );
        }

        for (const row of leaderRows) {
            await query(
                `INSERT INTO team_manager_links (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [id, row.id]
            );
            await query(
                `UPDATE users SET team_id = COALESCE(team_id, $1)
                 WHERE id = $2 AND org_id = $3 AND role IN ('manager','orgadmin')`,
                [id, row.id, req.user.org_id]
            );
        }

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
            'DELETE FROM team_manager_links WHERE team_id = $1 AND user_id = $2',
            [id, userId]
        );

        const ures = await query(
            'SELECT team_id, role FROM users WHERE id = $1 AND org_id = $2',
            [userId, req.user.org_id]
        );
        if (ures.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { team_id: primaryTeam, role } = ures.rows[0];

        if (role === 'user') {
            if (primaryTeam && String(primaryTeam) === String(id)) {
                await query('UPDATE users SET team_id = NULL WHERE id = $1 AND org_id = $2', [userId, req.user.org_id]);
            }
        } else if (role === 'manager' || role === 'orgadmin') {
            if (primaryTeam && String(primaryTeam) === String(id)) {
                const nextRes = await query(
                    'SELECT team_id FROM team_manager_links WHERE user_id = $1 LIMIT 1',
                    [userId]
                );
                const next = nextRes.rows[0]?.team_id ?? null;
                await query('UPDATE users SET team_id = $1 WHERE id = $2 AND org_id = $3', [next, userId, req.user.org_id]);
            }
        }

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('removeMember error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};
