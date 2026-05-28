import { evaluateOrgSubscription } from '../services/subscriptionService.js';

const PAYMENT_ALLOWED_PREFIXES = ['/payment', '/subscription'];

function isPaymentRoute(req) {
    const path = req.path || '';
    return PAYMENT_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

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
 * Dashboard routes: block when expired except orgadmin on /org/payment & /org/subscription.
 */
export const requireActiveSubscriptionForDashboard = async (req, res, next) => {
    if (req.user?.role === 'superadmin') {
        return next();
    }

    const orgId = req.user?.org_id;
    if (!orgId) {
        return res.status(400).json({ error: 'Organization context required' });
    }

    try {
        const evaluation = await evaluateOrgSubscription(orgId);
        if (evaluation.valid) {
            req.subscriptionEvaluation = evaluation;
            return next();
        }

        if (req.user.role === 'orgadmin' && isPaymentRoute(req)) {
            req.subscriptionEvaluation = evaluation;
            return next();
        }

        if (req.user.role === 'orgadmin') {
            return res.status(403).json({
                error: evaluation.reason || 'Subscription expired',
                code: 'BILLING_LOCKED',
                billing_locked: true,
            });
        }

        return res.status(403).json({
            error: evaluation.reason || 'Subscription is not active',
            code: evaluation.code || 'SUBSCRIPTION_EXPIRED',
        });
    } catch (error) {
        console.error('requireActiveSubscriptionForDashboard error:', error);
        res.status(500).json({ error: 'Failed to verify subscription' });
    }
};
