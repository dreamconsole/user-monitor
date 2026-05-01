import { query } from '../db.js';

export async function getOrgTimezone(orgId) {
    const r = await query('SELECT timezone FROM organizations WHERE id = $1', [orgId]);
    return r.rows[0]?.timezone || 'UTC';
}

/** YYYY-MM-DD for "now" in the org's IANA timezone (DB clock). */
export async function getOrgTodayDateString(orgId) {
    const tz = await getOrgTimezone(orgId);
    const r = await query(`SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS d`, [tz]);
    return r.rows[0]?.d;
}

/** YYYY-MM for current month in org timezone. */
export async function getOrgCurrentMonthString(orgId) {
    const tz = await getOrgTimezone(orgId);
    const r = await query(`SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE $1, 'YYYY-MM') AS m`, [tz]);
    return r.rows[0]?.m;
}
