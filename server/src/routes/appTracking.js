import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { query } from '../db.js';
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

// Old-value fetchers for audit logging
const fetchCategoryOldValues = async (req) => {
    const r = await query('SELECT * FROM app_categories WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    return r.rows[0] || null;
};

const fetchAppOldValues = async (req) => {
    const r = await query('SELECT * FROM tracked_apps WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    return r.rows[0] || null;
};

const getCategoryName = (old) => old?.name || null;
const getAppName = (old) => old?.display_name || old?.executable_name || null;

// App Categories (Admin only for CUD, Admin/Manager for Read)
router.get('/categories', authorizeRoles('orgadmin', 'manager'), getAppCategories);
router.post('/categories', authorizeRoles('orgadmin'), auditMiddleware('APP_CATEGORY_CREATED', { entityType: 'app_category' }), createAppCategory);
router.patch('/categories/:id', authorizeRoles('orgadmin'), auditMiddleware('APP_CATEGORY_UPDATED', { entityType: 'app_category', fetchOldValues: fetchCategoryOldValues, getTargetName: getCategoryName }), updateAppCategory);
router.delete('/categories/:id', authorizeRoles('orgadmin'), auditMiddleware('APP_CATEGORY_DELETED', { entityType: 'app_category', fetchOldValues: fetchCategoryOldValues, getTargetName: getCategoryName }), deleteAppCategory);

// Tracked Apps (Admin only for CUD, Admin/Manager for Read)
router.get('/apps', authorizeRoles('orgadmin', 'manager'), getTrackedApps);
router.post('/apps', authorizeRoles('orgadmin'), auditMiddleware('APP_CREATED', { entityType: 'tracked_app' }), createTrackedApp);
router.patch('/apps/:id', authorizeRoles('orgadmin'), auditMiddleware('APP_UPDATED', { entityType: 'tracked_app', fetchOldValues: fetchAppOldValues, getTargetName: getAppName }), updateTrackedApp);
router.patch('/apps/:id/map', authorizeRoles('orgadmin'), auditMiddleware('APP_MAPPED', { entityType: 'tracked_app', fetchOldValues: fetchAppOldValues, getTargetName: getAppName }), mapAppToCategory);
router.delete('/apps/:id', authorizeRoles('orgadmin'), auditMiddleware('APP_DELETED', { entityType: 'tracked_app', fetchOldValues: fetchAppOldValues, getTargetName: getAppName }), deleteTrackedApp);

// App Usage Logging (Agent authenticated)
router.post('/usage/log', logAppUsage);
router.get('/usage/user/:userId', authorizeRoles('orgadmin', 'manager', 'user'), getUserAppUsage);

// Reports & Dashboards
router.get('/reports/admin', authorizeRoles('orgadmin'), getAdminDashboard);
router.get('/reports/manager', authorizeRoles('manager'), getManagerDashboard);
router.get('/reports/user/:userId', authorizeRoles('orgadmin', 'manager', 'user'), getUserDashboard);
router.get('/reports/productivity/:userId', authorizeRoles('orgadmin', 'manager', 'user'), getProductivitySummary);

export default router;
