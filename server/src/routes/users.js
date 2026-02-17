import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, forceLogoutUser } from '../controllers/userController.js';
import { getUserFeatures, updateUserFeatures } from '../controllers/userFeaturesController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';

const router = express.Router();

router.use(authenticateToken);

// Get users: OrgAdmin and Manager
router.get('/', authorizeRoles('orgadmin', 'manager'), getUsers);

// Manage users: OrgAdmin only (Managers have restricted update access)
router.post('/', authorizeRoles('orgadmin'), auditMiddleware('USER_CREATED'), createUser);
router.patch('/:id', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_UPDATED'), updateUser);
router.delete('/:id', authorizeRoles('orgadmin'), auditMiddleware('USER_DELETED'), deleteUser);
router.post('/:id/force-logout', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_FORCE_LOGOUT'), forceLogoutUser);

// User Features / Overrides
router.get('/:id/features', authorizeRoles('orgadmin', 'manager'), getUserFeatures);
router.patch('/:id/features', authorizeRoles('orgadmin', 'manager'), auditMiddleware('USER_FEATURES_UPDATED'), updateUserFeatures);

export default router;
