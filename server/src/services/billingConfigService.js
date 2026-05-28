import { query } from '../db.js';

const DEFAULT_BILLING = {
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

export async function getBillingConfig() {
    const result = await query(
        `SELECT setting_value FROM global_settings WHERE setting_key = 'billing_manual_payment'`
    );
    if (result.rows.length === 0) return { ...DEFAULT_BILLING };
    const val = result.rows[0].setting_value;
    if (typeof val === 'string') {
        try {
            return { ...DEFAULT_BILLING, ...JSON.parse(val) };
        } catch {
            return { ...DEFAULT_BILLING };
        }
    }
    return { ...DEFAULT_BILLING, ...val };
}
