import {
    getSubscriptionSummary,
    upsertOrgSubscription,
    VALID_STATUSES,
} from '../services/subscriptionService.js';

/** Org admin: own subscription summary */
export const getMyOrgSubscription = async (req, res) => {
    try {
        const summary = await getSubscriptionSummary(req.user.org_id, req.user.role);
        res.json(summary);
    } catch (error) {
        console.error('getMyOrgSubscription error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};

/** Super admin: any org subscription + detail */
export const getOrgSubscriptionAdmin = async (req, res) => {
    try {
        const summary = await getSubscriptionSummary(req.params.id);
        res.json(summary);
    } catch (error) {
        console.error('getOrgSubscriptionAdmin error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};

export const updateOrgSubscriptionAdmin = async (req, res) => {
    const { id } = req.params;
    const {
        plan_id,
        status,
        licensed_seats,
        current_period_end,
        trial_ends_at,
        grace_ends_at,
        subscription_required,
        billing_cycle,
    } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });
    }

    try {
        const summary = await upsertOrgSubscription(id, {
            plan_id,
            status,
            licensed_seats,
            current_period_end,
            trial_ends_at,
            grace_ends_at,
            subscription_required,
            billing_cycle,
        });
        res.json(summary);
    } catch (error) {
        console.error('updateOrgSubscriptionAdmin error:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
};
