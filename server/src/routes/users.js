import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, forceLogoutUser } from '../controllers/userController.js';
import { getUserFeatures, updateUserFeatures } from '../controllers/userFeaturesController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get users: OrgAdmin and Manager
router.get('/', authorizeRoles('orgadmin', 'manager'), getUsers);

// Manage users: OrgAdmin only (Managers have restricted update access)
router.post('/', authorizeRoles('orgadmin'), createUser);
router.patch('/:id', authorizeRoles('orgadmin', 'manager'), updateUser);
router.delete('/:id', authorizeRoles('orgadmin'), deleteUser);
router.post('/:id/force-logout', authorizeRoles('orgadmin', 'manager'), forceLogoutUser);

// User Features / Overrides
router.get('/:id/features', authorizeRoles('orgadmin', 'manager'), getUserFeatures);
router.patch('/:id/features', authorizeRoles('orgadmin', 'manager'), updateUserFeatures);

export default router;
