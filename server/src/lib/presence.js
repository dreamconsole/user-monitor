import { query } from '../db.js';
import { broadcastToManagers } from '../websocket.js';

/** CRM "online" only while on shift; clears users + agent_sessions presence. */
export async function markUserShiftOffline(userId, orgId) {
    await query(
        `UPDATE users SET last_heartbeat = NULL, current_state = 'offline' WHERE id = $1 AND org_id = $2`,
        [userId, orgId]
    );
    await query(
        `UPDATE agent_sessions SET last_heartbeat_at = NULL WHERE user_id = $1 AND org_id = $2`,
        [userId, orgId]
    );
    try {
        broadcastToManagers(orgId, { type: 'USER_OFFLINE', userId });
    } catch (_) { /* non-critical */ }
}
