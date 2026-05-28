import { query, getClient } from '../db.js';

const VALID_STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'expired', 'paused'];

/** Active monitored employees (billable seats). */
export async function countBillableSeats(orgId) {
    const result = await query(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE org_id = $1 AND role = 'user' AND is_active = true
           AND (deleted_at IS NULL)`,
        [orgId]
    );
    return result.rows[0]?.count ?? 0;
}

export async function getOrgBillingFlags(orgId) {
    const result = await query(
        `SELECT id, name, is_active, subscription_required, max_users_limit
         FROM organizations WHERE id = $1`,
        [orgId]
    );
    return result.rows[0] || null;
}

export async function getSubscriptionByOrgId(orgId) {
    const result = await query('SELECT * FROM subscriptions WHERE org_id = $1', [orgId]);
    return result.rows[0] || null;
}

/**
 * @returns {{ valid: boolean, reason?: string, code?: string, subscription?: object, org?: object }}
 */
export async function evaluateOrgSubscription(orgId) {
    const org = await getOrgBillingFlags(orgId);
    if (!org) {
        return { valid: false, reason: 'Organization not found', code: 'ORG_NOT_FOUND' };
    }

    if (!org.is_active) {
        return { valid: false, reason: 'Organization is deactivated', code: 'ORG_INACTIVE', org };
    }

    if (org.subscription_required === false) {
        return { valid: true, exempt: true, org };
    }

    const sub = await getSubscriptionByOrgId(orgId);
    if (!sub) {
        return { valid: false, reason: 'No subscription found', code: 'NO_SUBSCRIPTION', org };
    }

    const now = new Date();

    if (sub.status === 'paused' || sub.status === 'expired') {
        return {
            valid: false,
            reason: 'Subscription is not active',
            code: 'SUBSCRIPTION_EXPIRED',
            subscription: sub,
            org,
        };
    }

    if (sub.status === 'trialing') {
        const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
        if (trialEnd && trialEnd < now) {
            return {
                valid: false,
                reason: 'Trial period has ended',
                code: 'TRIAL_EXPIRED',
                subscription: sub,
                org,
            };
        }
        return { valid: true, subscription: sub, org };
    }

    if (sub.status === 'past_due') {
        const graceEnd = sub.grace_ends_at ? new Date(sub.grace_ends_at) : null;
        if (graceEnd && graceEnd >= now) {
            return { valid: true, subscription: sub, org, grace: true };
        }
        if (!graceEnd) {
            // No grace configured — still allow until period end
            const periodEnd = new Date(sub.current_period_end);
            if (periodEnd >= now) {
                return { valid: true, subscription: sub, org };
            }
        }
        return {
            valid: false,
            reason: 'Payment overdue — subscription suspended',
            code: 'PAYMENT_PAST_DUE',
            subscription: sub,
            org,
        };
    }

    if (sub.status === 'canceled') {
        const periodEnd = new Date(sub.current_period_end);
        if (periodEnd >= now) {
            return { valid: true, subscription: sub, org, canceled: true };
        }
        return {
            valid: false,
            reason: 'Subscription has ended',
            code: 'SUBSCRIPTION_ENDED',
            subscription: sub,
            org,
        };
    }

    if (sub.status === 'active') {
        const periodEnd = new Date(sub.current_period_end);
        if (periodEnd < now) {
            return {
                valid: false,
                reason: 'Subscription period has ended',
                code: 'PERIOD_EXPIRED',
                subscription: sub,
                org,
            };
        }
        return { valid: true, subscription: sub, org };
    }

    return { valid: false, reason: 'Unknown subscription status', code: 'INVALID_STATUS', subscription: sub, org };
}

export async function assertSeatAvailable(orgId, additionalSeats = 1) {
    const org = await getOrgBillingFlags(orgId);
    const sub = await getSubscriptionByOrgId(orgId);
    const limit = sub?.licensed_seats ?? org?.max_users_limit ?? 10;
    const used = await countBillableSeats(orgId);
    if (used + additionalSeats > limit) {
        const err = new Error(`Seat limit reached (${used}/${limit}). Upgrade your plan to add more users.`);
        err.code = 'SEAT_LIMIT';
        err.status = 403;
        err.meta = { used, limit };
        throw err;
    }
    return { used, limit };
}

export async function createTrialSubscription(client, orgId, { licensedSeats = 5, trialDays = 14 } = {}) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    await client.query(
        `INSERT INTO subscriptions (
            org_id, plan_id, status, billing_cycle, licensed_seats,
            current_period_start, current_period_end, trial_ends_at, provider
        ) VALUES ($1, 'starter', 'trialing', 'monthly', $2, CURRENT_TIMESTAMP, $3, $3, 'manual')
        ON CONFLICT (org_id) DO NOTHING`,
        [orgId, licensedSeats, trialEnd.toISOString()]
    );

    await client.query(
        `UPDATE organizations SET max_users_limit = $1, subscription_required = true WHERE id = $2`,
        [licensedSeats, orgId]
    );
}

export async function createManualSubscription(client, orgId, {
    planId = 'starter',
    licensedSeats = 10,
    status = 'active',
    periodMonths = 12,
} = {}) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    await client.query(
        `INSERT INTO subscriptions (
            org_id, plan_id, status, billing_cycle, licensed_seats,
            current_period_start, current_period_end, provider
        ) VALUES ($1, $2, $3, 'monthly', $4, CURRENT_TIMESTAMP, $5, 'manual')
        ON CONFLICT (org_id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            status = EXCLUDED.status,
            licensed_seats = EXCLUDED.licensed_seats,
            current_period_end = EXCLUDED.current_period_end,
            updated_at = CURRENT_TIMESTAMP`,
        [orgId, planId, status, licensedSeats, periodEnd.toISOString()]
    );

    await client.query(
        `UPDATE organizations SET max_users_limit = $1 WHERE id = $2`,
        [licensedSeats, orgId]
    );
}

export async function upsertOrgSubscription(orgId, payload) {
    const {
        plan_id,
        status,
        licensed_seats,
        current_period_end,
        trial_ends_at,
        grace_ends_at,
        subscription_required,
        billing_cycle,
    } = payload;

    const client = await getClient();
    try {
        await client.query('BEGIN');

        if (subscription_required !== undefined) {
            await client.query(
                'UPDATE organizations SET subscription_required = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [subscription_required, orgId]
            );
        }

        const existing = await client.query('SELECT id FROM subscriptions WHERE org_id = $1', [orgId]);

        if (existing.rows.length === 0) {
            await client.query(
                `INSERT INTO subscriptions (
                    org_id, plan_id, status, billing_cycle, licensed_seats,
                    current_period_start, current_period_end, trial_ends_at, grace_ends_at, provider
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, 'manual')`,
                [
                    orgId,
                    plan_id || 'starter',
                    status || 'active',
                    billing_cycle || 'monthly',
                    licensed_seats ?? 10,
                    current_period_end || new Date(Date.now() + 365 * 86400000).toISOString(),
                    trial_ends_at || null,
                    grace_ends_at || null,
                ]
            );
        } else {
            await client.query(
                `UPDATE subscriptions SET
                    plan_id = COALESCE($2, plan_id),
                    status = COALESCE($3, status),
                    billing_cycle = COALESCE($4, billing_cycle),
                    licensed_seats = COALESCE($5, licensed_seats),
                    current_period_end = COALESCE($6, current_period_end),
                    trial_ends_at = COALESCE($7, trial_ends_at),
                    grace_ends_at = COALESCE($8, grace_ends_at),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE org_id = $1`,
                [
                    orgId,
                    plan_id,
                    status,
                    billing_cycle,
                    licensed_seats,
                    current_period_end,
                    trial_ends_at,
                    grace_ends_at,
                ]
            );
        }

        if (licensed_seats != null) {
            await client.query(
                'UPDATE organizations SET max_users_limit = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [licensed_seats, orgId]
            );
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }

    return getSubscriptionSummary(orgId);
}

/** Days until subscription period/trial end (0 if past). */
export function getDaysRemaining(sub) {
    if (!sub) return 0;
    const endRaw = sub.status === 'trialing' && sub.trial_ends_at
        ? sub.trial_ends_at
        : sub.current_period_end;
    if (!endRaw) return 0;
    const end = new Date(endRaw);
    const now = new Date();
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function getBillingUiState(evaluation, sub, role) {
    const daysRemaining = getDaysRemaining(sub);
    const accessValid = evaluation.valid === true;
    const billingLocked = !accessValid && role === 'orgadmin' && evaluation.exempt !== true;
    const renewalWarning = accessValid && daysRemaining > 0 && daysRemaining <= 7;

    let periodTotalDays = 30;
    if (sub?.current_period_start && sub?.current_period_end) {
        const start = new Date(sub.current_period_start);
        const end = new Date(sub.current_period_end);
        periodTotalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }

    return {
        days_remaining: daysRemaining,
        period_total_days: periodTotalDays,
        billing_locked: billingLocked,
        renewal_warning: renewalWarning,
        show_days_chart: role === 'orgadmin',
    };
}

export async function getSubscriptionSummary(orgId, role = null) {
    const org = await getOrgBillingFlags(orgId);
    const sub = await getSubscriptionByOrgId(orgId);
    const seatsUsed = await countBillableSeats(orgId);
    const evaluation = await evaluateOrgSubscription(orgId);
    const billing = getBillingUiState(evaluation, sub, role);

    return {
        org_id: orgId,
        org_name: org?.name,
        subscription_required: org?.subscription_required !== false,
        is_active: org?.is_active !== false,
        max_users_limit: org?.max_users_limit,
        seats_used: seatsUsed,
        licensed_seats: sub?.licensed_seats ?? org?.max_users_limit ?? 0,
        subscription: sub
            ? {
                plan_id: sub.plan_id,
                status: sub.status,
                billing_cycle: sub.billing_cycle,
                current_period_start: sub.current_period_start,
                current_period_end: sub.current_period_end,
                trial_ends_at: sub.trial_ends_at,
                grace_ends_at: sub.grace_ends_at,
                provider: sub.provider,
            }
            : null,
        access: {
            valid: evaluation.valid,
            code: evaluation.code,
            reason: evaluation.reason,
            exempt: evaluation.exempt === true,
        },
        billing,
    };
}

export { VALID_STATUSES };
