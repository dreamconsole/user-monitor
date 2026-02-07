import express from 'express';
import { getBreaks, createBreak, updateBreak, deleteBreak } from '../controllers/breakController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('orgadmin')); // Only admins can manage break types

router.get('/', getBreaks);
router.post('/', createBreak);
router.patch('/:id', updateBreak);
router.delete('/:id', deleteBreak);

export default router;
