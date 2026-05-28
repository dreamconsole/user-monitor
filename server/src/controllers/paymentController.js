import { query } from '../db.js';
import { getBillingConfig } from '../services/billingConfigService.js';
import { getSubscriptionSummary } from '../services/subscriptionService.js';
import { sendMail } from '../services/emailService.js';

export const getPaymentPage = async (req, res) => {
    try {
        const orgId = req.user.org_id;
        const billingConfig = await getBillingConfig();
        const summary = await getSubscriptionSummary(orgId, req.user.role);

        const pending = await query(
            `SELECT id, transaction_id, status, created_at
             FROM payment_requests
             WHERE org_id = $1 AND status = 'pending'
             ORDER BY created_at DESC LIMIT 1`,
            [orgId]
        );

        const licensed = summary.licensed_seats || 0;
        const pricePerSeat = Number(billingConfig.price_per_seat_monthly) || 0;
        const amountDue = licensed * pricePerSeat;

        res.json({
            billing_config: billingConfig,
            subscription: summary,
            amount_due: amountDue,
            currency: billingConfig.currency || 'INR',
            pending_request: pending.rows[0] || null,
        });
    } catch (error) {
        console.error('getPaymentPage error:', error);
        res.status(500).json({ error: 'Failed to load payment page' });
    }
};

export const submitPaymentRequest = async (req, res) => {
    const { transaction_id, amount } = req.body;
    if (!transaction_id || typeof transaction_id !== 'string' || transaction_id.trim().length < 4) {
        return res.status(400).json({ error: 'Please enter a valid transaction ID (at least 4 characters)' });
    }

    try {
        const orgId = req.user.org_id;
        const summary = await getSubscriptionSummary(orgId, req.user.role);

        const existing = await query(
            `SELECT id FROM payment_requests WHERE org_id = $1 AND status = 'pending'`,
            [orgId]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({
                error: 'You already have a payment pending review. Please wait for staff verification.',
            });
        }

        const result = await query(
            `INSERT INTO payment_requests (org_id, submitted_by, transaction_id, amount, currency, status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING *`,
            [
                orgId,
                req.user.id,
                transaction_id.trim(),
                amount ?? null,
                summary.billing?.currency || 'INR',
            ]
        );

        res.status(201).json({
            message: 'Payment submitted for verification. Our team will review within 6–8 hours.',
            request: result.rows[0],
        });
    } catch (error) {
        console.error('submitPaymentRequest error:', error);
        res.status(500).json({ error: 'Failed to submit payment' });
    }
};

export const notifyStaffOfPayment = async (req, res) => {
    const { transaction_id } = req.body;
    const txId = (transaction_id || '').trim();

    try {
        const orgId = req.user.org_id;
        const billingConfig = await getBillingConfig();
        const summary = await getSubscriptionSummary(orgId, req.user.role);
        const staffEmail =
            billingConfig.staff_notification_email ||
            billingConfig.support_email ||
            process.env.BILLING_STAFF_EMAIL;

        if (!staffEmail) {
            return res.status(400).json({
                error: 'Staff notification email is not configured. Use Submit for verification or contact support.',
            });
        }

        if (txId) {
            const existing = await query(
                `SELECT id FROM payment_requests WHERE org_id = $1 AND status = 'pending'`,
                [orgId]
            );
            if (existing.rows.length === 0) {
                await query(
                    `INSERT INTO payment_requests (org_id, submitted_by, transaction_id, status)
                     VALUES ($1, $2, $3, 'pending')`,
                    [orgId, req.user.id, txId]
                );
            }
        }

        const subject = `[${process.env.APP_NAME || 'User Monitor'}] Payment verification — ${summary.org_name}`;
        const html = `
            <p>Organization <strong>${summary.org_name}</strong> submitted a manual payment for review.</p>
            <ul>
                <li><strong>Transaction ID:</strong> ${txId || '(see pending request)'}</li>
                <li><strong>Org ID:</strong> ${orgId}</li>
                <li><strong>Seats:</strong> ${summary.seats_used} / ${summary.licensed_seats}</li>
                <li><strong>Submitted by:</strong> ${req.user.id}</li>
            </ul>
            <p>Please verify in Super Admin and activate the subscription.</p>
        `;

        await sendMail({
            to: staffEmail,
            subject,
            html,
        });

        res.json({
            message: 'Notification sent to our team. Verification usually takes 6–8 hours.',
        });
    } catch (error) {
        console.error('notifyStaffOfPayment error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
};

export const listPendingPayments = async (req, res) => {
    try {
        const result = await query(
            `SELECT pr.*, o.name as org_name, u.full_name as submitted_by_name, u.email as submitted_by_email
             FROM payment_requests pr
             JOIN organizations o ON o.id = pr.org_id
             JOIN users u ON u.id = pr.submitted_by
             WHERE pr.status = 'pending'
             ORDER BY pr.created_at ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('listPendingPayments error:', error);
        res.status(500).json({ error: 'Failed to list payments' });
    }
};
