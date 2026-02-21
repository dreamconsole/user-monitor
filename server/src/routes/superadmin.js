import express from 'express';
import { getOrgs, updateOrg, deleteOrg, getSettings, updateSettings, getSystemHealth } from '../controllers/superadminController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All superadmin routes require authentication and superadmin role
router.use(authenticateToken, authorizeRoles('superadmin'));

// Orgs Management
router.get('/orgs', getOrgs);
router.put('/orgs/:id', updateOrg);
router.delete('/orgs/:id', deleteOrg); // Note: Should probably soft-delete or deactivate

// System Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// System Health / Stats
router.get('/health', getSystemHealth);

export default router;
