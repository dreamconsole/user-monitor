import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireActiveSubscriptionForDashboard } from '../middleware/subscription.js';
import { getDailySummary, getBreakUsage, getScreenshots, getIdleEvents } from '../controllers/reportController.js';

const router = express.Router();

router.use(authenticateToken, requireActiveSubscriptionForDashboard);

// All roles can access reports, but logic inside controller filters data based on role
router.get('/summary', getDailySummary);
router.get('/breaks', getBreakUsage);
router.get('/screenshots', getScreenshots);
router.get('/idle', getIdleEvents);

export default router;
