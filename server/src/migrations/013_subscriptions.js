import { getClient } from '../db.js';

/**
 * Subscriptions + organizations.subscription_required
 * Run: node src/migrations/013_subscriptions.js
 */
async function migrate() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE organizations
            ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN DEFAULT true
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
                plan_id VARCHAR(50) NOT NULL DEFAULT 'starter',
                status VARCHAR(30) NOT NULL DEFAULT 'active',
                billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
                licensed_seats INTEGER NOT NULL DEFAULT 10,
                current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                current_period_end TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year'),
                trial_ends_at TIMESTAMPTZ,
                grace_ends_at TIMESTAMPTZ,
                provider VARCHAR(30) DEFAULT 'manual',
                provider_customer_id VARCHAR(255),
                provider_subscription_id VARCHAR(255),
                canceled_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)
        `);

        // Seed subscription for orgs that don't have one
        await client.query(`
            INSERT INTO subscriptions (
                org_id, plan_id, status, billing_cycle, licensed_seats,
                current_period_start, current_period_end, provider
            )
            SELECT
                o.id,
                'starter',
                'active',
                'monthly',
                COALESCE(o.max_users_limit, 10),
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP + INTERVAL '1 year',
                'manual'
            FROM organizations o
            WHERE NOT EXISTS (
                SELECT 1 FROM subscriptions s WHERE s.org_id = o.id
            )
        `);

        // Sync max_users_limit from subscription licensed_seats where missing
        await client.query(`
            UPDATE organizations o
            SET max_users_limit = s.licensed_seats
            FROM subscriptions s
            WHERE s.org_id = o.id
              AND (o.max_users_limit IS NULL OR o.max_users_limit < s.licensed_seats)
        `);

        await client.query('COMMIT');
        console.log('Migration 013_subscriptions completed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration 013_subscriptions failed:', e);
        throw e;
    } finally {
        client.release();
    }
}

migrate().catch(() => process.exit(1));
