import express from 'express';
import { registerOrg, login, getMe, requestPasswordReset, resetPassword, changePassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register-org', registerOrg);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticateToken, changePassword);

export default router;
