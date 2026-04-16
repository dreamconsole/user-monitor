import express from 'express';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getAssignments, assignCampaign, unassignCampaign } from '../controllers/campaignController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('orgadmin', 'manager'));

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

router.get('/:id/assignments', getAssignments);
router.post('/:id/assign', assignCampaign);
router.delete('/:id/assignments/:assignment_id', unassignCampaign);

export default router;
