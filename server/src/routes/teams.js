import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as teamController from '../controllers/teamController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', teamController.getTeams);
router.post('/', teamController.createTeam);
router.put('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

router.get('/:id/members', teamController.getTeamMembers);
router.post('/:id/members', teamController.addMembers);
router.delete('/:id/members/:userId', teamController.removeMember);

export default router;
