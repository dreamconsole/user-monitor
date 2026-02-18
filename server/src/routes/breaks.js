import express from 'express';
import { getBreaks, createBreak, updateBreak, deleteBreak } from '../controllers/breakController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { query } from '../db.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('orgadmin'));

const fetchBreakOldValues = async (req) => {
    const r = await query('SELECT * FROM break_master WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    return r.rows[0] || null;
};

const getBreakName = (old) => old?.name || null;

router.get('/', getBreaks);
router.post('/', auditMiddleware('BREAK_CREATED', { entityType: 'break' }), createBreak);
router.patch('/:id', auditMiddleware('BREAK_UPDATED', { entityType: 'break', fetchOldValues: fetchBreakOldValues, getTargetName: getBreakName }), updateBreak);
router.delete('/:id', auditMiddleware('BREAK_DELETED', { entityType: 'break', fetchOldValues: fetchBreakOldValues, getTargetName: getBreakName }), deleteBreak);

export default router;
