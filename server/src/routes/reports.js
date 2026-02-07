import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import * as reportController from '../controllers/reportController.js';

const router = express.Router();

router.use(authenticateToken);

// All roles can access reports, but logic inside controller filters data based on role
router.get('/summary', reportController.getDailySummary);
router.get('/breaks', reportController.getBreakUsage);
router.get('/screenshots', reportController.getScreenshots);

export default router;
