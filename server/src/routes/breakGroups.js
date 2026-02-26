import express from 'express';
import { getBreakGroups, createBreakGroup, updateBreakGroup, deleteBreakGroup } from '../controllers/breakGroupController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { query } from '../db.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('orgadmin'));

const fetchOldValues = async (req) => {
    const r = await query('SELECT * FROM break_groups WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    return r.rows[0] || null;
};

const getEntityName = (old) => old?.name || null;

router.get('/', getBreakGroups);
router.post('/', auditMiddleware('BREAK_GROUP_CREATED', { entityType: 'break_group' }), createBreakGroup);
router.patch('/:id', auditMiddleware('BREAK_GROUP_UPDATED', { entityType: 'break_group', fetchOldValues, getTargetName: getEntityName }), updateBreakGroup);
router.delete('/:id', auditMiddleware('BREAK_GROUP_DELETED', { entityType: 'break_group', fetchOldValues, getTargetName: getEntityName }), deleteBreakGroup);

export default router;
