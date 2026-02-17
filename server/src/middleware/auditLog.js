import { query } from '../db.js';

/**
 * Log an audit event to the audit_logs table.
 * @param {object} params
 * @param {string} params.orgId - Organization ID
 * @param {string} params.actorId - User who performed the action
 * @param {string} params.action - Action description (e.g., 'USER_CREATED', 'SETTINGS_UPDATED')
 * @param {string} [params.targetId] - ID of the target entity
 * @param {object} [params.oldValues] - Previous values (for updates)
 * @param {object} [params.newValues] - New values (for creates/updates)
 */
export async function logAudit({ orgId, actorId, action, targetId = null, oldValues = null, newValues = null }) {
    try {
        await query(
            `INSERT INTO audit_logs (org_id, actor_id, action, target_id, old_values, new_values)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [orgId, actorId, action, targetId, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null]
        );
    } catch (error) {
        // Don't let audit logging failures break the main flow
        console.error('Audit log error:', error.message);
    }
}

/**
 * Express middleware that automatically logs write operations.
 * Attach after auth middleware.
 */
export function auditMiddleware(action) {
    return (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        res.json = function (data) {
            // Only log successful operations
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const orgId = req.user?.org_id;
                const actorId = req.user?.id;
                const targetId = req.params?.id || data?.id || null;

                if (orgId && actorId) {
                    logAudit({
                        orgId,
                        actorId,
                        action,
                        targetId,
                        newValues: ['POST', 'PATCH', 'PUT'].includes(req.method) ? req.body : null
                    }).catch(() => {}); // fire-and-forget
                }
            }
            return originalJson(data);
        };

        next();
    };
}
