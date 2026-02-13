import express from 'express';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply Auth Middleware (User must be logged in, usually a manager)
router.use(authenticateToken);

router.get('/', getNotifications);
router.post('/mark-read', markAsRead);

export default router;
