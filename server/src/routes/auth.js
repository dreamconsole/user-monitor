import express from 'express';
import { registerOrg, login, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register-org', registerOrg);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);

export default router;
