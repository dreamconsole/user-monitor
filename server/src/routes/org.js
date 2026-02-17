import express from 'express';
import { getOrgSettings, updateOrgSettings } from '../controllers/orgController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';

const router = express.Router();

router.get('/settings', authenticateToken, authorizeRoles('orgadmin'), getOrgSettings);
router.patch('/settings', authenticateToken, authorizeRoles('orgadmin'), auditMiddleware('ORG_SETTINGS_UPDATED'), updateOrgSettings);

export default router;
