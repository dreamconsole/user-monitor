import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
    getAppCategories,
    createAppCategory,
    updateAppCategory,
    deleteAppCategory
} from '../controllers/appCategoriesController.js';
import {
    getTrackedApps,
    mapAppToCategory,
    createTrackedApp,
    updateTrackedApp,
    deleteTrackedApp
} from '../controllers/trackedAppsController.js';
import {
    logAppUsage,
    getUserAppUsage
} from '../controllers/appUsageController.js';
import {
    getAdminDashboard,
    getManagerDashboard,
    getUserDashboard,
    getProductivitySummary
} from '../controllers/appReportsController.js';

const router = express.Router();

router.use(authenticateToken);

// App Categories (Admin only for CUD, Admin/Manager for Read)
router.get('/categories', authorizeRoles('orgadmin', 'manager'), getAppCategories);
router.post('/categories', authorizeRoles('orgadmin'), createAppCategory);
router.patch('/categories/:id', authorizeRoles('orgadmin'), updateAppCategory);
router.delete('/categories/:id', authorizeRoles('orgadmin'), deleteAppCategory);

// Tracked Apps (Admin only for CUD, Admin/Manager for Read)
router.get('/apps', authorizeRoles('orgadmin', 'manager'), getTrackedApps);
router.post('/apps', authorizeRoles('orgadmin'), createTrackedApp);
router.patch('/apps/:id', authorizeRoles('orgadmin'), updateTrackedApp);
router.patch('/apps/:id/map', authorizeRoles('orgadmin'), mapAppToCategory);
router.delete('/apps/:id', authorizeRoles('orgadmin'), deleteTrackedApp);

// App Usage Logging (Agent authenticated)
router.post('/usage/log', logAppUsage);
router.get('/usage/user/:userId', authorizeRoles('orgadmin', 'manager', 'user'), getUserAppUsage);

// Reports & Dashboards
router.get('/reports/admin', authorizeRoles('orgadmin'), getAdminDashboard);
router.get('/reports/manager', authorizeRoles('manager'), getManagerDashboard);
router.get('/reports/user/:userId', authorizeRoles('orgadmin', 'manager', 'user'), getUserDashboard);
router.get('/reports/productivity/:userId', authorizeRoles('orgadmin', 'manager', 'user'), getProductivitySummary);

export default router;
