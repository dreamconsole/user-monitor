import express from 'express';
import { getAdminStats, getManagerStats, getUserStats, getUserHourlyStats, getTimelineData } from '../controllers/statsController.js';
import { getProductivityScore, getTeamProductivity, getTeamsProductivity } from '../controllers/productivityController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { requireActiveSubscriptionForDashboard } from '../middleware/subscription.js';

const router = express.Router();

router.use(authenticateToken, requireActiveSubscriptionForDashboard);

router.get('/admin', authorizeRoles('orgadmin'), getAdminStats);
router.get('/manager', authorizeRoles('orgadmin', 'manager'), getManagerStats);
router.get('/user', authorizeRoles('orgadmin', 'manager', 'user'), getUserStats);
router.get('/user/:userId/hourly', authorizeRoles('orgadmin', 'manager', 'user'), getUserHourlyStats);
router.get('/timeline', authorizeRoles('orgadmin', 'manager', 'user'), getTimelineData);
router.get('/productivity', authenticateToken, getProductivityScore);
router.get('/team-productivity', authenticateToken, getTeamProductivity);
router.get('/teams-productivity', authenticateToken, authorizeRoles('orgadmin'), getTeamsProductivity);

export default router;
