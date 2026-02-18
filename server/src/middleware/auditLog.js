import { query } from '../db.js';

/**
 * Log an audit event to the audit_logs table.
 * @param {object} params
 * @param {string} params.orgId - Organization ID
 * @param {string} params.actorId - User who performed the action
 * @param {string} params.action - Action description (e.g., 'USER_CREATED', 'SETTINGS_UPDATED')
 * @param {string} [params.targetId] - ID of the target entity
 * @param {string} [params.targetName] - Human-readable name of the target
 * @param {object} [params.oldValues] - Previous values (for updates)
 * @param {object} [params.newValues] - New values (for creates/updates)
 * @param {string} [params.actorRole] - Role of the actor
 * @param {string} [params.entityType] - Type of entity affected
 * @param {string} [params.ipAddress] - IP address of the request
 */
export async function logAudit({
    orgId, actorId, action, targetId = null, targetName = null,
    oldValues = null, newValues = null, actorRole = null,
    entityType = null, ipAddress = null
}) {
    try {
        await query(
            `INSERT INTO audit_logs 
             (org_id, actor_id, action, target_id, target_name, old_values, new_values, actor_role, entity_type, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                orgId, actorId, action, targetId, targetName,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                actorRole, entityType, ipAddress
            ]
        );
    } catch (error) {
        console.error('Audit log error:', error.message);
    }
}

/**
 * Extract client IP from request, handling proxies.
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.connection?.remoteAddress
        || req.ip
        || null;
}

/**
 * Sanitize request body for logging -- strip sensitive fields like passwords.
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'newPassword', 'currentPassword', 'password_hash', 'token'];
    for (const key of sensitiveKeys) {
        if (key in sanitized) {
            sanitized[key] = '***REDACTED***';
        }
    }
    return sanitized;
}

/**
 * Express middleware that automatically logs write operations with old/new value capture.
 * 
 * @param {string} action - Action label (e.g., 'USER_UPDATED', 'BREAK_DELETED')
 * @param {object} [options] - Configuration options
 * @param {string} [options.entityType] - Entity type (e.g., 'user', 'break', 'org_settings')
 * @param {function} [options.fetchOldValues] - Async function(req) that returns the old state before mutation
 * @param {function} [options.getTargetName] - Function(oldValues, req) that returns a human-readable target name
 */
export function auditMiddleware(action, options = {}) {
    const { entityType = null, fetchOldValues = null, getTargetName = null } = options;

    return async (req, res, next) => {
        // Fetch old values BEFORE the controller runs
        let oldValues = null;
        if (fetchOldValues) {
            try {
                oldValues = await fetchOldValues(req);
            } catch (err) {
                console.error('Audit fetchOldValues error:', err.message);
            }
        }

        // Derive target name from old values if a getter is provided
        let targetName = null;
        if (getTargetName) {
            try {
                targetName = getTargetName(oldValues, req);
            } catch {}
        }

        const originalJson = res.json.bind(res);

        res.json = function (data) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const orgId = req.user?.org_id;
                const actorId = req.user?.id;
                const actorRole = req.user?.role || null;
                const targetId = req.params?.id || data?.id || null;
                const ipAddress = getClientIp(req);

                // For create operations, try to get target name from response
                if (!targetName && data) {
                    targetName = data.full_name || data.name || data.display_name || data.executable_name || null;
                }

                const newValues = ['POST', 'PATCH', 'PUT'].includes(req.method)
                    ? sanitizeBody(req.body)
                    : null;

                if (orgId && actorId) {
                    logAudit({
                        orgId, actorId, action, targetId, targetName,
                        oldValues, newValues, actorRole, entityType, ipAddress
                    }).catch(() => {});
                }
            }
            return originalJson(data);
        };

        next();
    };
}
