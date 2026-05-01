import { query } from '../db.js';

/**
 * All team IDs a manager/orgadmin may act on: primary `users.team_id` plus `team_manager_links`.
 */
export async function getManagerTeamIds(managerUserId, orgId) {
    const r = await query(
        `SELECT DISTINCT q.team_id
         FROM (
             SELECT tml.team_id
             FROM team_manager_links tml
             INNER JOIN teams te ON te.id = tml.team_id AND te.org_id = $2
             WHERE tml.user_id = $1
             UNION
             SELECT u.team_id
             FROM users u
             WHERE u.id = $1 AND u.org_id = $2 AND u.team_id IS NOT NULL
         ) q
         WHERE q.team_id IS NOT NULL`,
        [managerUserId, orgId]
    );
    return r.rows.map((row) => row.team_id);
}

export async function managerCanAccessTeam(managerUserId, orgId, teamId) {
    if (!teamId) return false;
    const teams = await getManagerTeamIds(managerUserId, orgId);
    return teams.some((t) => String(t) === String(teamId));
}

/** Manager may act on a user if same person, or user's team is one of the manager's teams (orgadmins excluded). */
export async function managerCanAccessTeamMember(managerUserId, orgId, targetUserId) {
    if (String(managerUserId) === String(targetUserId)) return true;
    const target = await query(
        'SELECT team_id, role FROM users WHERE id = $1 AND org_id = $2',
        [targetUserId, orgId]
    );
    if (target.rows.length === 0) return false;
    if (target.rows[0].role === 'orgadmin') return false;
    const tid = target.rows[0].team_id;
    if (!tid) return false;
    return managerCanAccessTeam(managerUserId, orgId, tid);
}
