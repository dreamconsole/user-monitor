import express from 'express';
import { getOrgSettings, updateOrgSettings } from '../controllers/orgController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { query } from '../db.js';

const router = express.Router();

const fetchOrgOldValues = async (req) => {
    const orgResult = await query(
        'SELECT name, timezone, shift_start_time, shift_end_time, shift_duration, work_days, start_of_day FROM organizations WHERE id = $1',
        [req.user.org_id]
    );
    const featResult = await query('SELECT * FROM org_features WHERE org_id = $1', [req.user.org_id]);
    return {
        org: orgResult.rows[0] || null,
        features: featResult.rows[0] || null
    };
};

router.get('/settings', authenticateToken, authorizeRoles('orgadmin'), getOrgSettings);
router.patch('/settings', authenticateToken, authorizeRoles('orgadmin'),
    auditMiddleware('ORG_SETTINGS_UPDATED', { entityType: 'org_settings', fetchOldValues: fetchOrgOldValues, getTargetName: (old) => old?.org?.name || 'Organization' }),
    updateOrgSettings
);

export default router;
