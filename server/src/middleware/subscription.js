import { evaluateOrgSubscription } from '../services/subscriptionService.js';

/**
 * Ensures the organization has a valid subscription (or is exempt).
 * Superadmin users are always allowed.
 */
export const requireActiveSubscription = async (req, res, next) => {
    if (req.user?.role === 'superadmin') {
        return next();
    }

    const orgId = req.subscriptionOrgId || req.user?.org_id || req.body?.org_id;
    if (!orgId) {
        return res.status(400).json({ error: 'Organization context required' });
    }

    if (req.user?.org_id && req.body?.org_id && req.user.org_id !== req.body.org_id) {
        return res.status(403).json({
            success: false,
            command: 'FORCE_LOGOUT',
            error: 'Organization mismatch',
        });
    }

    try {
        const evaluation = await evaluateOrgSubscription(orgId);
        if (!evaluation.valid) {
            const isAgent = req.path?.includes('/agent') || req.baseUrl?.includes('/agent');
            const payload = {
                success: false,
                error: evaluation.reason,
                code: evaluation.code,
            };
            if (isAgent || req.headers['x-agent-client']) {
                payload.command = 'FORCE_LOGOUT';
            }
            return res.status(403).json(payload);
        }
        req.subscriptionEvaluation = evaluation;
        next();
    } catch (error) {
        console.error('requireActiveSubscription error:', error);
        res.status(500).json({ error: 'Failed to verify subscription' });
    }
};

/**
 * Block dashboard/API access when subscription invalid (non-agent routes).
 */
export const requireActiveSubscriptionForDashboard = async (req, res, next) => {
    if (req.user?.role === 'superadmin') {
        return next();
    }
    return requireActiveSubscription(req, res, next);
};
