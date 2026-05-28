import express from 'express';
import { getOrgs, createOrg, updateOrg, deleteOrg, getSettings, updateSettings, getSystemHealth, getDBStats, cleanupData } from '../controllers/superadminController.js';
import { getOrgSubscriptionAdmin, updateOrgSubscriptionAdmin } from '../controllers/subscriptionController.js';
import { listPendingPayments } from '../controllers/paymentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All superadmin routes require authentication and superadmin role
router.use(authenticateToken, authorizeRoles('superadmin'));

// Orgs Management
router.get('/orgs', getOrgs);
router.post('/orgs', createOrg);
router.put('/orgs/:id', updateOrg);
router.get('/payments/pending', listPendingPayments);
router.get('/orgs/:id/subscription', getOrgSubscriptionAdmin);
router.put('/orgs/:id/subscription', updateOrgSubscriptionAdmin);
router.delete('/orgs/:id', deleteOrg); // Note: Should probably soft-delete or deactivate

// System Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// System Health / Stats
router.get('/health', getSystemHealth);
router.get('/db-stats', getDBStats);
router.post('/cleanup', cleanupData);

export default router;
