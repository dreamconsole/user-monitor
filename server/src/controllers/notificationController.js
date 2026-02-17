import { query } from '../db.js';

export const getNotifications = async (req, res) => {
    const userId = req.user.id; // The manager
    const { is_read, limit = 50, offset = 0 } = req.query;

    try {
        let sql = `
            SELECT n.*, u.full_name as actor_name 
            FROM notifications n
            LEFT JOIN users u ON n.actor_id = u.id
            WHERE n.recipient_id = $1
        `;
        const params = [userId];

        if (is_read !== undefined) {
            sql += ` AND n.is_read = $${params.length + 1}`;
            params.push(is_read === 'true');
        }

        sql += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        // efficient count (parameterized to avoid SQL injection)
        let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE recipient_id = $1';
        const countParams = [userId];
        if (is_read !== undefined) {
            countSql += ' AND is_read = $2';
            countParams.push(is_read === 'true');
        }
        const countRes = await query(countSql, countParams);

        res.status(200).json({
            success: true,
            notifications: result.rows,
            pagination: {
                total: parseInt(countRes.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('getNotifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications'
        });
    }
};

export const markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { notification_ids, mark_all } = req.body; // Expects array of IDs or mark_all flag

    try {
        if (mark_all) {
            await query(
                'UPDATE notifications SET is_read = true WHERE recipient_id = $1',
                [userId]
            );
        } else if (Array.isArray(notification_ids) && notification_ids.length > 0) {
            await query(
                'UPDATE notifications SET is_read = true WHERE recipient_id = $1 AND id = ANY($2::uuid[])',
                [userId, notification_ids]
            );
        } else {
            return res.status(400).json({ error: 'No notification IDs provided' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('markAsRead error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notifications'
        });
    }
};
