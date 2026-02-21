import express from 'express';
import { registerOrg, login, getMe, requestPasswordReset, resetPassword, changePassword, getSSOStatus, verifySSO } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register-org', registerOrg);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticateToken, changePassword);

// SSO Routes
router.get('/sso/status', getSSOStatus);
router.post('/sso/verify', verifySSO);

export default router;
