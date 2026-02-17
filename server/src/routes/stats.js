import express from 'express';
import { getAdminStats, getManagerStats, getUserStats, getUserHourlyStats, getTimelineData } from '../controllers/statsController.js';
import { getProductivityScore, getTeamProductivity } from '../controllers/productivityController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/admin', authorizeRoles('orgadmin'), getAdminStats);
router.get('/manager', authorizeRoles('orgadmin', 'manager'), getManagerStats);
router.get('/user', authorizeRoles('orgadmin', 'manager', 'user'), getUserStats);
router.get('/user/:userId/hourly', authorizeRoles('orgadmin', 'manager', 'user'), getUserHourlyStats);
router.get('/timeline', authorizeRoles('orgadmin', 'manager', 'user'), getTimelineData);
router.get('/productivity', authorizeRoles('orgadmin', 'manager', 'user'), getProductivityScore);
router.get('/team-productivity', authorizeRoles('orgadmin', 'manager'), getTeamProductivity);

export default router;
