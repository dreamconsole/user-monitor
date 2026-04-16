import { query } from '../db.js';

const checkCampaignFeature = async (org_id) => {
    const featureRes = await query('SELECT is_campaigns_enabled FROM org_features WHERE org_id = $1', [org_id]);
    return featureRes.rows.length > 0 && featureRes.rows[0].is_campaigns_enabled;
};

// List campaigns
export const getCampaigns = async (req, res) => {
    try {
        const { org_id } = req.user;
        
        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const result = await query(
            'SELECT * FROM campaigns WHERE org_id = $1 ORDER BY created_at DESC',
            [org_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
};

// Create a campaign
export const createCampaign = async (req, res) => {
    try {
        const { org_id } = req.user;

        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Campaign name is required' });
        }

        const result = await query(
            'INSERT INTO campaigns (org_id, name) VALUES ($1, $2) RETURNING *',
            [org_id, name]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
};

// Update a campaign
export const updateCampaign = async (req, res) => {
    try {
        const { org_id } = req.user;

        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const { id } = req.params;
        const { name, is_active } = req.body;

        const check = await query('SELECT org_id FROM campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0 || check.rows[0].org_id !== org_id) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const result = await query(
            'UPDATE campaigns SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING *',
            [name, is_active, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
};

// Delete a campaign
export const deleteCampaign = async (req, res) => {
    try {
        const { org_id } = req.user;

        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const { id } = req.params;

        const check = await query('SELECT org_id FROM campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0 || check.rows[0].org_id !== org_id) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        await query('DELETE FROM campaigns WHERE id = $1', [id]);
        res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
};

// Get assignments for a campaign
export const getAssignments = async (req, res) => {
    try {
        const { org_id } = req.user;

        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const { id } = req.params;

        const check = await query('SELECT org_id FROM campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0 || check.rows[0].org_id !== org_id) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const result = await query(`
            SELECT 
                ca.id as assignment_id,
                ca.team_id,
                ca.user_id,
                t.name as team_name,
                u.full_name as user_name
            FROM campaign_assignments ca
            LEFT JOIN teams t ON ca.team_id = t.id
            LEFT JOIN users u ON ca.user_id = u.id
            WHERE ca.campaign_id = $1
            ORDER BY ca.assigned_at DESC
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
};

// Assign campaign to users or teams
export const assignCampaign = async (req, res) => {
    try {
        const { org_id } = req.user;

        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const { id } = req.params;
        const { target_type, target_ids } = req.body; // target_type: 'user' or 'team', target_ids: array

        if (!target_type || !target_ids || target_ids.length === 0) {
            return res.status(400).json({ error: 'Target type and target IDs are required' });
        }

        const check = await query('SELECT org_id FROM campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0 || check.rows[0].org_id !== org_id) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        await query('BEGIN');

        for (const target_id of target_ids) {
            const teamId = target_type === 'team' ? target_id : null;
            const userId = target_type === 'user' ? target_id : null;

            await query(`
                INSERT INTO campaign_assignments (campaign_id, team_id, user_id) 
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [id, teamId, userId]);
        }

        await query('COMMIT');
        res.json({ message: 'Campaign assigned successfully' });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Error assigning campaign:', error);
        res.status(500).json({ error: 'Failed to assign campaign' });
    }
};

// Remove assignment
export const unassignCampaign = async (req, res) => {
    try {
        const { org_id } = req.user;

        if (!(await checkCampaignFeature(org_id))) {
            return res.status(403).json({ error: 'Campaigns feature is not enabled for this organization' });
        }
        const { id, assignment_id } = req.params;

        // Verify ownership (campaign belongs to org)
        const check = await query('SELECT org_id FROM campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0 || check.rows[0].org_id !== org_id) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        await query('DELETE FROM campaign_assignments WHERE id = $1 AND campaign_id = $2', [assignment_id, id]);
        res.json({ message: 'Assignment removed successfully' });
    } catch (error) {
        console.error('Error removing assignment:', error);
        res.status(500).json({ error: 'Failed to remove assignment' });
    }
};

