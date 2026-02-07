import express from 'express';
import { getAdminStats, getManagerStats, getUserStats } from '../controllers/statsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/admin', authorizeRoles('orgadmin'), getAdminStats);
router.get('/manager', authorizeRoles('orgadmin', 'manager'), getManagerStats);
router.get('/user', authorizeRoles('orgadmin', 'manager', 'user'), getUserStats);

export default router;
