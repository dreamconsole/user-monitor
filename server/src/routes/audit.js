import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorizeRoles('orgadmin', 'manager'), getAuditLogs);

export default router;
