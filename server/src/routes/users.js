import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, forceLogoutUser, resetUserPassword } from '../controllers/userController.js';
import { getUserFeatures, updateUserFeatures } from '../controllers/userFeaturesController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { query } from '../db.js';

const router = express.Router();

router.use(authenticateToken);

// Old-value fetchers for audit logging
const fetchUserOldValues = async (req) => {
    const r = await query(
        'SELECT id, full_name, email, role, is_active, manager_id, timezone, emp_id, payroll_id, site, force_logout FROM users WHERE id = $1 AND org_id = $2',
        [req.params.id, req.user.org_id]
    );
    return r.rows[0] || null;
};

const fetchUserFeaturesOldValues = async (req) => {
    const r = await query('SELECT * FROM user_features WHERE user_id = $1', [req.params.id]);
    return r.rows[0] || null;
};

const getUserName = (old) => old?.full_name || null;

// Get users: OrgAdmin and Manager
router.get('/', authorizeRoles('orgadmin', 'manager'), getUsers);

// Manage users: OrgAdmin only (Managers have restricted update access)
router.post('/', authorizeRoles('orgadmin'), auditMiddleware('USER_CREATED', { entityType: 'user' }), createUser);
router.patch('/:id', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_UPDATED', { entityType: 'user', fetchOldValues: fetchUserOldValues, getTargetName: getUserName }), updateUser);
router.delete('/:id', authorizeRoles('orgadmin'), auditMiddleware('USER_DELETED', { entityType: 'user', fetchOldValues: fetchUserOldValues, getTargetName: getUserName }), deleteUser);
router.post('/:id/force-logout', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_FORCE_LOGOUT', { entityType: 'user', fetchOldValues: fetchUserOldValues, getTargetName: getUserName }), forceLogoutUser);
router.post('/:id/reset-password', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_PASSWORD_RESET', { entityType: 'user', fetchOldValues: fetchUserOldValues, getTargetName: getUserName }), resetUserPassword);

// User Features / Overrides
router.get('/:id/features', authorizeRoles('orgadmin', 'manager'), getUserFeatures);
router.patch('/:id/features', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_FEATURES_UPDATED', { entityType: 'user', fetchOldValues: fetchUserFeaturesOldValues, getTargetName: (old, req) => `User ${req.params.id} features` }), updateUserFeatures);

export default router;
