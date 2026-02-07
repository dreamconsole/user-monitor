import express from 'express';
import { getOrgSettings, updateOrgSettings } from '../controllers/orgController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/settings', authenticateToken, authorizeRoles('orgadmin'), getOrgSettings);
router.patch('/settings', authenticateToken, authorizeRoles('orgadmin'), updateOrgSettings);

export default router;
