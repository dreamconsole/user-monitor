import { getClient } from '../db.js';

async function migrate() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS payment_requests (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                submitted_by UUID NOT NULL REFERENCES users(id),
                transaction_id VARCHAR(255) NOT NULL,
                amount DECIMAL(12, 2),
                currency VARCHAR(10) DEFAULT 'INR',
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMPTZ,
                reviewed_by UUID REFERENCES users(id)
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_requests_org ON payment_requests(org_id, created_at DESC)
        `);

        const billingDefaults = {
            bank_account_name: '',
            bank_name: '',
            bank_account_number: '',
            bank_ifsc: '',
            upi_id: '',
            qr_image_url: '',
            support_email: '',
            staff_notification_email: '',
            price_per_seat_monthly: 200,
            currency: 'INR',
            manual_review_message:
                'Our staff will verify your payment manually. Activation usually takes 6–8 hours after you submit your transaction ID.',
        };

        await client.query(
            `INSERT INTO global_settings (setting_key, setting_value, description)
             VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (setting_key) DO NOTHING`,
            [
                'billing_manual_payment',
                JSON.stringify(billingDefaults),
                'Bank/UPI details and manual payment copy for org billing page',
            ]
        );

        await client.query('COMMIT');
        console.log('Migration 014_manual_payments completed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration 014_manual_payments failed:', e);
        throw e;
    } finally {
        client.release();
    }
}

migrate().catch(() => process.exit(1));
