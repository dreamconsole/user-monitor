import { query } from '../db.js';

export const getAuditLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 30,
            action,
            entityType,
            actorId,
            targetId,
            dateFrom,
            dateTo,
            search
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const orgId = req.user.org_id;

        let sql = `
            SELECT 
                al.id,
                al.action,
                al.entity_type,
                al.target_id,
                al.target_name,
                al.old_values,
                al.new_values,
                al.actor_role,
                al.ip_address,
                al.performed_at,
                u.full_name as actor_name,
                u.email as actor_email
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_id = u.id
            WHERE al.org_id = $1
        `;
        const params = [orgId];
        let paramCount = 1;

        // Role-based access: managers can only see their own logs + logs targeting their reports
        if (req.user.role === 'manager') {
            paramCount++;
            sql += ` AND (
                al.actor_id = $${paramCount}
                OR al.target_id IN (SELECT id FROM users WHERE manager_id = $${paramCount} AND org_id = $1)
            )`;
            params.push(req.user.id);
        }

        // Filters
        if (action) {
            paramCount++;
            sql += ` AND al.action = $${paramCount}`;
            params.push(action);
        }

        if (entityType) {
            paramCount++;
            sql += ` AND al.entity_type = $${paramCount}`;
            params.push(entityType);
        }

        if (actorId) {
            paramCount++;
            sql += ` AND al.actor_id = $${paramCount}`;
            params.push(actorId);
        }

        if (targetId) {
            paramCount++;
            sql += ` AND al.target_id = $${paramCount}`;
            params.push(targetId);
        }

        if (dateFrom) {
            paramCount++;
            sql += ` AND al.performed_at >= $${paramCount}`;
            params.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            sql += ` AND al.performed_at <= $${paramCount}`;
            params.push(dateTo);
        }

        if (search) {
            paramCount++;
            sql += ` AND (al.target_name ILIKE $${paramCount} OR al.action ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // Get total count for pagination
        const countSql = sql.replace(
            /SELECT[\s\S]*?FROM audit_logs/,
            'SELECT COUNT(*) as total FROM audit_logs'
        );
        const countResult = await query(countSql, params);
        const total = parseInt(countResult.rows[0].total);

        // Add ordering and pagination
        sql += ` ORDER BY al.performed_at DESC`;
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(offset);

        const result = await query(sql, params);

        res.json({
            logs: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('getAuditLogs error:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
};
