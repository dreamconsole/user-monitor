# User Monitor — Subscription & Billing Design

**Document version:** 1.0  
**Date:** May 20, 2026  
**Audience:** Backend, frontend, and product developers  
**Status:** Phase 1 implemented (manual subscriptions; no Stripe/Razorpay yet)

---

## 1. Executive summary

User Monitor is a multi-tenant employee monitoring SaaS. Organizations (`organizations`) already have `max_users_limit` and `is_active`, and feature toggles live in `org_features`. There is **no payment provider**, **no subscription expiry dates**, and **no enforcement** of seat limits or org suspension on login or agent APIs.

This document defines how to add **organization-based subscriptions** with **per-agent (seat) monthly billing**, how to detect expiry, what to enforce in code, and a phased implementation plan for developer review.

---

## 2. Business model

### 2.1 What we sell

| Concept | Definition |
|---------|------------|
| **Customer** | One organization (tenant) |
| **Billable unit** | One **seat** = one active monitored employee (`role = 'user'`, `is_active = true`, not soft-deleted) |
| **Billing cycle** | Monthly or annual per organization |
| **Plans** | Tiers (e.g. Starter, Pro, Enterprise) that map to `org_features` |

Recommended default: **price per seat per month**, minimum seats optional (e.g. 5).

### 2.2 Who counts as a seat (decision required)

| Option | Rule | Pros | Cons |
|--------|------|------|------|
| **A (recommended)** | Count active users with `role = 'user'` | Simple, matches “per employee” | Managers/admins free |
| **B** | Count all active users | Stricter revenue | May upset small teams |
| **C** | Count users with agent heartbeat in last N days | Pay for actual usage | Harder to explain on invoice |

**Recommendation:** Option A for v1. Document in admin UI: “Seats = active employees with monitoring role.”

### 2.3 Multiple devices per user

Today one user can have multiple `agent_sessions` (e.g. laptop + desktop). **One seat = one user**, not one device. Do not bill per device unless product explicitly changes.

---

## 3. Current system (as-is)

### 3.1 Existing database fields

| Table / field | Purpose today |
|---------------|---------------|
| `organizations.max_users_limit` | Seat cap; set by Super Admin only |
| `organizations.is_active` | Manual org kill switch |
| `org_features.*` | Screenshots, breaks, campaigns, AFK, etc. |
| `users.is_active` | Per-user suspend (not billing) |
| `agent_sessions.token_expires_at` | Device auth token (~30 days) — **not subscription** |
| JWT `expiresIn: '1d'` | Dashboard session — **not subscription** |

### 3.2 Existing UI

- **Super Admin → Organizations:** edit `max_users_limit`, toggle `is_active`, campaigns flag.
- **Org Settings:** shows `max_users_limit` read-only.
- **Public registration:** `POST /auth/register-org` creates org + orgadmin with no trial or payment.

### 3.3 Enforcement gaps (must fix with subscriptions)

| Gap | Risk |
|-----|------|
| `createUser` does not check `max_users_limit` | Unlimited free users |
| `login` does not check `organizations.is_active` | Suspended orgs still access dashboard |
| Agent `/agent/*` does not check org subscription | Expired orgs still sync data |
| `register-org` is open | Free unlimited tenants |
| No link between plan and `org_features` | Manual feature toggles only |

---

## 4. Proposed data model

### 4.1 New table: `subscriptions`

One **current** subscription row per org (or subscription history table + `is_current` flag).

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,           -- e.g. 'starter', 'pro', 'enterprise'
    status VARCHAR(30) NOT NULL,            -- see Section 5
    billing_cycle VARCHAR(20) NOT NULL,     -- 'monthly' | 'annual'
    licensed_seats INTEGER NOT NULL DEFAULT 5,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,  -- primary expiry signal
    trial_ends_at TIMESTAMPTZ,
    grace_ends_at TIMESTAMPTZ,              -- optional: past_due grace
    provider VARCHAR(30),                   -- 'stripe' | 'razorpay' | 'manual'
    provider_customer_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (org_id)  -- if single current row per org
);
```

### 4.2 Optional: `subscription_events`

Audit trail for webhooks and manual changes (invoice.paid, seat change, super admin extension).

### 4.3 Sync with existing columns

| When subscription updates | Also update |
|---------------------------|-------------|
| `licensed_seats` changes | `organizations.max_users_limit` |
| Status → expired / canceled (past period end) | `organizations.is_active = false` (optional but useful for queries) |
| Plan changes | `org_features` per plan matrix (Section 7) |

---

## 5. Subscription lifecycle & expiry

### 5.1 Status values

| Status | Meaning | Agent access | Dashboard access |
|--------|---------|--------------|------------------|
| `trialing` | Trial period | Full | Full |
| `active` | Paid and current | Full | Full |
| `past_due` | Payment failed, in grace | Configurable (recommend: full for 7 days) | Full + billing banner |
| `canceled` | Won’t renew; still in paid period | Full until `current_period_end` | Full until end |
| `expired` | Period ended or grace ended | **Block** (`FORCE_LOGOUT`) | **Block** or read-only |
| `paused` | Manual super-admin hold | Block | Block |

### 5.2 When is subscription “expired”?

Use a single helper, e.g. `isOrgSubscriptionValid(orgId)`:

```
VALID if:
  status IN ('trialing', 'active', 'past_due', 'canceled')
  AND (
    (status = 'trialing' AND (trial_ends_at IS NULL OR trial_ends_at > NOW()))
    OR (status IN ('active', 'past_due') AND current_period_end > NOW())
    OR (status = 'canceled' AND current_period_end > NOW())
    OR (status = 'past_due' AND grace_ends_at > NOW())
  )
  AND organizations.is_active = true

EXPIRED otherwise
```

**Source of truth for “renewal date”:** `current_period_end` (from payment provider webhook or manual super-admin entry).

### 5.3 Grace period

Recommend **7 days** after `past_due` before hard `expired`. Store `grace_ends_at` when payment fails; clear when payment succeeds.

---

## 6. Enforcement architecture

### 6.1 Central middleware

Create `requireActiveSubscription` used on:

| Layer | Routes / actions |
|-------|------------------|
| **Agent** | All `POST /agent/*` (heartbeat, screenshot, activity-session, break-log, browser-activity) |
| **Dashboard API** | Optional: block writes when expired; allow read-only reports for N days |
| **Auth** | `login`, `auth/me`, SSO verify |
| **Users** | `createUser`, re-activate user (`is_active = true`) |

On failure for agent:

```json
{
  "success": false,
  "command": "FORCE_LOGOUT",
  "error": "Organization subscription expired. Contact your administrator."
}
```

Electron agent already handles `FORCE_LOGOUT` in `sync.js`.

### 6.2 Seat limit enforcement

On `createUser` (and user re-activation):

```sql
SELECT COUNT(*) FROM users
WHERE org_id = $1 AND role = 'user' AND is_active = true AND deleted_at IS NULL;
```

If `count >= licensed_seats` (or `max_users_limit`) → `403` with message: “Seat limit reached. Upgrade your plan.”

### 6.3 Registration gate

`POST /auth/register-org` options (pick one for v1):

1. **Trial org:** Create subscription with `status = trialing`, `trial_ends_at = NOW() + 14 days`, `licensed_seats = 3`.
2. **Invite-only:** Disable public register; Super Admin creates orgs.
3. **Payment first:** Redirect to Stripe Checkout before org is active.

### 6.4 Cron jobs

Update jobs that process all orgs (e.g. `aggregateAppUsage`) to skip orgs where subscription is not valid.

### 6.5 Do not confuse with

| Field | Not subscription |
|-------|------------------|
| `agent_sessions.token_expires_at` | Device session |
| Agent local `tokenExpiry` (30 days) | Cached login |
| Dashboard JWT 1 day | Session only |

---

## 7. Plan → features mapping

Use existing `org_features` table. Example matrix:

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Activity tracking | Yes | Yes | Yes |
| Screenshots | No | Yes | Yes |
| Breaks | Yes | Yes | Yes |
| Campaigns | No | No | Yes |
| Force logout | No | Yes | Yes |
| Max retention (days) | 30 | 90 | 365 |

On plan change (webhook or super admin):

1. Update `subscriptions.plan_id`
2. `UPDATE org_features SET ...` from matrix
3. Agent receives new flags on next **heartbeat** (already implemented)

Downgrade: disable features server-side; do not rely on agent-only toggles.

---

## 8. Payment integration (Phase 2)

### 8.1 Provider flow

1. Org admin chooses plan + seat count.
2. Backend creates Checkout Session (Stripe) or Subscription (Razorpay).
3. User pays on provider hosted page.
4. Webhook → update `subscriptions` row.
5. Set `organizations.max_users_limit = licensed_seats`.

### 8.2 Webhook requirements

| Requirement | Why |
|-------------|-----|
| Signature verification | Security |
| Idempotency (`event_id` stored) | Prevent duplicate seat updates |
| Handle `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `deleted` | Lifecycle |
| Manual reconciliation job | Missed webhooks |

### 8.3 Seat changes mid-cycle

Define policy (product decision):

- **Increase seats:** Immediate; prorate charge via provider.
- **Decrease seats:** At next renewal, or immediate if `count <= new limit`.

### 8.4 Enterprise / manual billing

`provider = 'manual'`: Super Admin sets `licensed_seats`, `current_period_end`, `status = active` without Stripe.

---

## 9. API & UI changes

### 9.1 New / updated APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /org/subscription` | Current plan, seats used/licensed, renewal date, status |
| `POST /org/subscription/checkout` | Start payment (Phase 2) |
| `POST /webhooks/stripe` (or razorpay) | Provider events |
| `PUT /superadmin/orgs/:id/subscription` | Manual override |

### 9.2 Org admin UI

- Billing card on Settings: plan name, **seats used / licensed**, **renews on**, status badge.
- Banners: “Trial ends in 3 days”, “Payment failed — update billing”.
- Upgrade / manage billing button → provider portal.

### 9.3 Super Admin UI

Extend Organizations table:

- Plan, status, `current_period_end`, seats used/licensed.
- Actions: extend trial, set manual subscription, force deactivate.

### 9.4 Agent UI

On subscription failure: clear message after forced logout (not generic network error).

---

## 10. Security & abuse prevention

| Risk | Mitigation |
|------|------------|
| Unlimited free orgs via register | Trial limits + captcha + email verification |
| Trial abuse (same email, many orgs) | One trial per email domain or verified email |
| Long-lived JWT after expiry | Check subscription on `/auth/me` and agent heartbeat |
| Super admin org | Exempt from subscription checks |
| Heavy API usage on expired org | Middleware blocks agent sync |

---

## 11. Operations & compliance

| Topic | Action |
|-------|--------|
| Audit log | Log subscription create/update/cancel (use existing audit middleware) |
| Data after cancel | Policy: read-only 30 days, then delete or archive (GDPR) |
| Invoices | Provider-hosted or export from Stripe/Razorpay |
| Email | Payment failed, trial ending, subscription renewed (use `emailService`) |
| Metering (optional) | Screenshot count / storage GB for future overage |

---

## 12. Phased implementation plan

### Phase 1 — Foundation (no payment provider)

1. Migration: `subscriptions` table + seed row for existing orgs (`manual`, `active`, 1 year end).
2. `isOrgSubscriptionValid()` helper + middleware on agent + login + createUser.
3. Enforce `organizations.is_active` on login.
4. `register-org` → 14-day trial subscription.
5. Super Admin: edit subscription dates and seats.
6. Org Settings: show subscription summary.

**Exit criteria:** Cannot exceed seats; expired trial blocks agent; super admin can extend manually.

### Phase 2 — Payments

1. Stripe or Razorpay checkout + customer portal.
2. Webhooks with idempotency.
3. `past_due` + grace period automation.
4. Billing emails.

### Phase 3 — Polish

1. Annual billing discount.
2. Read-only mode after expiry.
3. Usage metering / storage limits per plan.
4. Self-serve seat add/remove with proration.

---

## 13. Appendix A — Code touchpoints (User Monitor repo)

| Area | File(s) | Change |
|------|---------|--------|
| User create | `server/src/controllers/userController.js` | Seat check |
| Login | `server/src/controllers/authController.js` | Org active + subscription |
| Agent | `server/src/controllers/agentController.js` | Subscription on heartbeat + uploads |
| Register | `authController.registerOrg` | Create trial subscription |
| Super Admin | `superadminController.js`, `SuperAdminOrgs.jsx` | Subscription CRUD |
| Org Settings | `orgController.js`, `Settings.jsx` | Display + upgrade link |
| Features | `org_features`, heartbeat merge in `agentController` | Plan → features |
| Agent client | `electron-agent/src/services/sync.js` | Already supports FORCE_LOGOUT |
| Cron | `server/src/cron.js`, `jobs/aggregateAppUsage.js` | Skip invalid orgs |

---

## 14. Implementation notes (Phase 1 — done)

- Migration: `npm run migrate:subscriptions` in `server/`
- Service: `server/src/services/subscriptionService.js`
- Middleware: `server/src/middleware/subscription.js` (agent + dashboard routes)
- APIs: `GET/PUT /superadmin/orgs/:id/subscription`, `GET /org/subscription`
- UI: Super Admin navbar org dropdown + context panel; Org Settings billing card
- New orgs via `register-org` get 14-day trial; Super Admin create org gets 1-year manual subscription

## 15. Appendix B — Complete gap checklist

- [x] `subscriptions` table + migration for existing orgs  
- [x] Seat definition documented and enforced (`role = user`)  
- [x] `max_users_limit` synced from `licensed_seats`  
- [x] Subscription check on all `/agent/*` routes  
- [x] Subscription + `is_active` check on `login` / `me`  
- [x] Seat check on `createUser` and user re-activation  
- [x] Trial on `register-org` (14 days, 5 seats)  
- [ ] Plan → `org_features` mapping (manual toggles still)  
- [x] Grace period logic for `past_due` (service layer)  
- [x] Super Admin subscription UI + org navbar selector  
- [x] Org admin billing card on Settings  
- [ ] Agent user-visible error on expiry (uses FORCE_LOGOUT)  
- [ ] Webhook handler + idempotency (Phase 2)  
- [ ] Billing emails (Phase 2)  
- [ ] Audit log for subscription changes  
- [ ] Data retention policy after cancel  
- [ ] Cron jobs respect subscription status  

---

## 15. Open questions for team review

1. Do managers and org admins count toward seats?  
2. Grace period length (7 vs 14 days)?  
3. After expiry: hard block vs read-only dashboard for 30 days?  
4. Stripe vs Razorpay (or both) for launch region?  
5. Minimum seats per org?  
6. Free trial length and seat cap for self-signup?  
7. Annual plan discount percentage?  

---

**End of document**
