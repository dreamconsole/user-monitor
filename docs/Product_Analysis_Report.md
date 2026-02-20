# User Monitor - Product Analysis Report

**Date:** February 2026
**Product:** User Monitor - Employee Activity Tracking Platform
**Version:** 1.0.0

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Competitive Analysis](#2-competitive-analysis)
3. [SaaS Market Feature Comparison](#3-saas-market-feature-comparison)
4. [Buyer Perspective - Questions & Suggestions](#4-buyer-perspective)
5. [Timezone & Multi-Shift Architecture](#5-timezone--multi-shift-architecture)
6. [Data & UX Audit](#6-data--ux-audit)
7. [Priority Action Items](#7-priority-action-items)

---

## 1. Product Overview

### Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Web Dashboard** | React + Vite + Tailwind CSS + Shadcn UI | Admin/Manager/User web interface |
| **Backend API** | Node.js + Express + PostgreSQL | REST API, authentication, data storage |
| **Desktop Agent** | Electron + better-sqlite3 | Activity monitoring, screenshots, app tracking |
| **Browser Extension** | Chrome MV3 + Firefox MV2 | Browser domain/tab tracking |
| **Real-time** | WebSocket (ws) | Live heartbeat & status updates |

### Current Feature Set

- **Authentication & Authorization:** JWT-based auth, role-based access (orgadmin, manager, user), forgot/reset password
- **User Management:** CRUD, manager hierarchy, force logout, password reset by admin/manager, per-user feature overrides
- **Organization Settings:** Timezone, shift times, work days, feature toggles (screenshots, AFK, breaks, activity tracking)
- **Activity Monitoring:** Keyboard/mouse event tracking, idle/AFK detection with configurable thresholds
- **Screenshots:** Periodic capture with configurable intervals, upload and storage, viewable in reports
- **Work Sessions:** Start/end tracking, total work/idle/break seconds, status management
- **App Tracking:** Desktop application usage logging, app categorization (productive/neutral/non-productive), productivity scoring
- **Browser Tracking:** Browser extension for domain-level tracking, native messaging + HTTP fallback, expandable browser domain view in App Usage dashboard
- **Break Management:** Configurable break types with limits, break logging, violation notifications to managers
- **Dashboard & Stats:** Admin/manager/user dashboards, hourly activity stats, team comparison, productivity scores
- **Reports:** Daily summary, break usage, screenshots, idle events, PDF export
- **Timeline:** Visual activity timeline per user per day
- **Audit Logs:** Comprehensive audit trail with actor, action, target, old vs new values, IP address
- **Notifications:** In-app notifications (break violations, etc.), notification bell with mark-as-read
- **Multi-tenant:** Full org_id isolation across all tables

### Desktop Agent Capabilities

- Auto-login with stored credentials
- Activity monitoring (keyboard/mouse events)
- Screenshot capture at configurable intervals
- App usage tracking (active window detection)
- Browser detection (Chrome, Edge, Brave, Opera, Firefox)
- Silent browser extension installation (Windows Registry / Linux policies)
- Periodic browser re-scanning for newly installed browsers (every 6 hours)
- Local SQLite storage with batch sync to server every 5 minutes
- Heartbeat system for online/offline status
- Force logout support from server
- Power save blocker to prevent system sleep during tracking

### Database Tables

| Table | Partitioned | Description |
|-------|------------|-------------|
| organizations | No | Company details and subscription limits |
| org_features | No | Organization-level feature toggles |
| users | No | User accounts with role and manager hierarchy |
| user_features | No | Per-user feature overrides |
| break_master | No | Break type definitions with limits |
| work_sessions | No | Work session start/end with totals |
| agent_sessions | No | Device/agent session tracking |
| activity_logs | **Yes (monthly)** | High-volume keyboard/mouse activity logs |
| screenshots | No | Screenshot metadata and storage paths |
| break_logs | No | Break start/end/duration records |
| audit_logs | No | Change audit trail with old/new values |
| heartbeats | No | Agent heartbeat history |
| notifications | No | In-app notification records |
| app_categories | No | Application categorization definitions |
| tracked_apps | No | Discovered application registry |
| app_usage_logs | **Yes (monthly)** | High-volume app usage time logs |
| user_app_summary | No | Aggregated daily app usage stats |
| browser_activity_logs | No | Browser domain/tab activity from extensions |

---

## 2. Competitive Analysis

### Feature Comparison with Market Leaders

| Feature | Time Doctor | Hubstaff | ActivTrak | Teramind | **User Monitor** |
|---------|------------|----------|-----------|----------|-----------------|
| Activity tracking | Yes | Yes | Yes | Yes | **Yes** |
| Screenshots | Yes | Yes | No | Yes | **Yes** |
| App tracking | Yes | Yes | Yes | Yes | **Yes** |
| Browser/URL tracking | Yes | Yes | Yes | Yes | **Yes** |
| Break management | Basic | Basic | No | No | **Yes (Advanced)** |
| Idle/AFK detection | Yes | Yes | Yes | Yes | **Yes** |
| Productivity scoring | Yes | Yes | Yes | Yes | **Yes** |
| PDF reports | Some | Some | Yes | Yes | **Yes** |
| Audit logs | No | No | Yes | Yes | **Yes** |
| Self-hosted option | No | No | No | Yes | **Yes** |
| Per-user feature toggles | No | No | No | Limited | **Yes** |
| Multi-org/tenant | Yes | Yes | Yes | Yes | **Yes** |
| Project/Task tracking | Yes | Yes | No | No | **No** |
| GPS/Location tracking | No | Yes | No | No | **No** |
| Payroll integration | Yes | Yes | No | No | **No** |
| Client/Invoice reporting | Yes | No | No | No | **No** |
| Live screen viewing | Yes | No | No | Yes | **No** |
| Mobile app | Yes | Yes | No | No | **No** |
| Alert rules engine | Limited | Limited | Yes | Yes | **No** |
| SSO/SAML | Yes | Yes | Yes | Yes | **No** |

### Current Differentiators

1. **Self-hosted option** - Companies with strict data policies can run it on their own infrastructure. Most competitors are cloud-only.
2. **Advanced break management** - Configurable break types with time limits, usage tracking, and automatic violation notifications to managers. Most competitors offer only basic pause/resume.
3. **Per-user feature overrides** - Disable screenshots for HR but enable for developers. Granular control at the individual level.
4. **Comprehensive audit trail** - Full change history with who, what, when, old values, new values. Important for compliance-heavy industries.
5. **Hybrid browser tracking** - Extension-based for accuracy + window title fallback for any browser. Future-proof against new browsers.

---

## 3. SaaS Market Feature Comparison

### What's Built (Core SaaS Features)

| Category | Status | Details |
|----------|--------|---------|
| Authentication | Done | JWT, role-based, forgot/reset password |
| Multi-tenancy | Done | org_id isolation on all tables |
| User management | Done | CRUD, hierarchy, force logout |
| Activity monitoring | Done | Keyboard/mouse events, idle detection |
| Screenshots | Done | Periodic capture, configurable intervals |
| App tracking | Done | Desktop app usage + productivity categorization |
| Browser tracking | Done | Extension + hybrid approach |
| Break management | Done | Types, limits, violations, notifications |
| Dashboard | Done | Admin/manager/user views |
| Reports | Done | Summary, breaks, screenshots, idle, PDF export |
| Audit logs | Done | Full change trail with old/new values |
| Notifications | Done | In-app with bell icon |
| Real-time | Partial | WebSocket for heartbeats, but dashboard doesn't auto-refresh |

### What's Missing for Production SaaS

| Category | Feature | Priority | Details |
|----------|---------|----------|---------|
| **Billing** | Subscription/payment system | Critical | No Stripe/Razorpay integration, no pricing tiers, no trial management |
| **Onboarding** | Welcome wizard & guided setup | High | New orgs have no guided first-time experience |
| **Teams** | Department/team structure | High | Only manager hierarchy, no department grouping |
| **Email** | Transactional emails | High | No welcome emails, alert emails, or weekly digest |
| **Agent Updates** | Auto-update mechanism | High | No way to push agent updates to installed clients |
| **Super Admin** | Platform admin panel | Medium | No way to manage all organizations from a single admin view |
| **Rate Limiting** | Per-org API limits | Medium | Basic rate limiting exists but not org-aware |
| **Data Export** | CSV/Excel export | Medium | Only PDF export currently available |
| **Webhooks** | Event notification system | Medium | No way for orgs to integrate with external tools |
| **SSO/SAML** | Single Sign-On | Medium | Enterprise customers expect this |
| **2FA** | Two-factor authentication | Medium | No additional auth security layer |
| **Mobile App** | iOS/Android | Low | Not critical for initial launch |
| **White-labeling** | Custom branding | Low | Not needed initially, useful for resellers |
| **API Docs** | Swagger/OpenAPI documentation | Low | No public API documentation |

---

## 4. Buyer Perspective

### Questions a Buyer Would Ask

#### Security & Compliance

| Question | Current Answer | Gap |
|----------|---------------|-----|
| "Where is my data stored?" | Can be self-hosted or cloud | Good - this is a selling point |
| "Is data encrypted at rest?" | No encryption at rest | Need to add PostgreSQL encryption or disk-level encryption |
| "Is data encrypted in transit?" | HTTPS for API, but agent uses HTTP in dev | Need HTTPS enforcement in production |
| "Do you have SOC 2 / ISO 27001?" | No | Long-term goal for enterprise sales |
| "Can employees see what's being tracked?" | Yes, employees have their own dashboard | Good - transparency builds trust |
| "GDPR compliance?" | No specific GDPR features | Need data deletion requests, consent management |

#### Functionality

| Question | Current Answer | Gap |
|----------|---------------|-----|
| "Can I set rules per department?" | Per-user overrides, but no departments | Need department/team structure |
| "Can I integrate with Slack/Teams?" | No integrations | Need webhook/integration system |
| "Can I export to PowerBI/Tableau?" | PDF only | Need CSV/Excel/API export |
| "Does it work on Mac?" | No, Windows + Linux only | Mac support needed for many companies |
| "What if agent loses internet?" | Stores locally, syncs when back online | Good - already handled |
| "Can I track project time?" | No project/task system | Need project time tracking |

#### Privacy

| Question | Current Answer | Gap |
|----------|---------------|-----|
| "Can employees opt out of screenshots?" | Admin can disable per-user | Good |
| "Is there a personal time / privacy mode?" | No | Need a way for users to pause tracking during personal time |
| "Can we blur sensitive content in screenshots?" | No | Useful for banking/personal email protection |
| "Do you track keystrokes content?" | No, only event counts | Good - privacy-friendly approach |

#### Pricing & Business

| Question | Current Answer | Gap |
|----------|---------------|-----|
| "Per user per month pricing?" | No billing system | Critical - need pricing tiers |
| "Free trial?" | No trial system | Need trial period with auto-expiry |
| "What's in each tier?" | No tiers defined | Need Basic/Pro/Enterprise tiers |
| "Annual discount?" | No billing | Need annual billing option |

### Key Suggestions from a Buyer's Perspective

1. **Employee transparency dashboard** - Give employees a clean "My Day" view showing their own productivity, breaks, and stats. Builds trust and reduces resistance to monitoring.
2. **Screenshot blurring** - Option to automatically blur sensitive areas or let admins choose which apps trigger blurring.
3. **Working hours enforcement** - Agent should respect shift hours and not track outside them (or mark it differently).
4. **Data retention settings** - Let admins choose: keep data for 30/60/90/365 days. Important for storage costs and compliance.
5. **Quick onboarding** - "Get started in 5 minutes" experience: create org, invite users, download agent, start tracking.
6. **Comparison with self** - Show employees/managers "this week vs last week" trends, not just raw numbers.

---

## 5. Timezone & Multi-Shift Architecture

### Current Implementation

| Component | How it works |
|-----------|-------------|
| Organization timezone | `organizations.timezone` (e.g., `Asia/Kolkata`) |
| User timezone | `users.timezone` (per user, overrides org) |
| Shift configuration | Single shift per org: `shift_start_time` and `shift_end_time` |
| Work date calculation | Uses user's timezone: `AT TIME ZONE user.timezone` |
| Reports | Date-based filtering using `work_date` column |

### What Works

- Single timezone org with one shift
- Users in different timezones within same org (each user has their own timezone)
- Work date calculation respects individual user timezone

### What Doesn't Work

| Problem | Details |
|---------|---------|
| **Only 1 shift per org** | Can't define Day shift (9am-6pm) AND Night shift (10pm-7am) |
| **No shift assignment per user** | Can't say "User A is Day shift, User B is Night shift" |
| **Night shift crossing midnight** | Shift from 10pm to 7am spans two calendar dates, `work_date` might split it |
| **No shift rotation** | Can't configure "Week 1: Day shift, Week 2: Night shift" |
| **Reports are date-based** | Night shift 10pm Feb 15 to 7am Feb 16 - which date does it count as? |

### Recommended Architecture for Multi-Shift

#### New Tables Needed

```
shift_master
  - id UUID
  - org_id UUID
  - name VARCHAR (e.g., "Day Shift", "Night Shift", "US East Shift")
  - start_time TIME
  - end_time TIME
  - timezone VARCHAR
  - work_days TEXT[] (e.g., ["Mon","Tue","Wed","Thu","Fri"])
  - is_active BOOLEAN

user_shifts
  - id UUID
  - user_id UUID
  - shift_id UUID
  - effective_from DATE
  - effective_to DATE (NULL = current)
```

#### How Reports Would Work

1. Get user's assigned shift
2. Use shift's timezone and start/end times
3. For night shifts crossing midnight: the work_date is the date when the shift STARTS
4. Example: Night shift 10pm Feb 15 to 7am Feb 16 → work_date = Feb 15
5. Reports filter by shift-aware work_date, not just calendar date

#### Multi-timezone Organization Example

```
Organization: Global Corp (timezone: UTC)

Shift 1: "India Day"    - 9:00 AM to 6:00 PM IST (Asia/Kolkata)
Shift 2: "US East"      - 9:00 AM to 6:00 PM EST (America/New_York)
Shift 3: "India Night"  - 10:00 PM to 7:00 AM IST (Asia/Kolkata)

User A → India Day shift → Reports calculated in IST
User B → US East shift → Reports calculated in EST
User C → India Night shift → Reports use shift-start date as work_date
```

---

## 6. Data & UX Audit

### Data Stored but NOT Visible in UI

| Data | Stored In | Visible in UI? | Action Needed |
|------|-----------|---------------|---------------|
| Detailed activity logs (keyboard/mouse events) | `activity_logs` | Only as summary stats | Show detailed activity timeline |
| Heartbeat history | `heartbeats` | Only as online/offline dot | Could show "last seen" history |
| Agent sessions (device info) | `agent_sessions` | Not shown anywhere | Show devices per user |
| Browser activity (domains) | `browser_activity_logs` | Only via expandable table row | Needs dedicated charts/visualization |
| Notification history | `notifications` | Bell dropdown only | Need full notification history page |
| App category productivity breakdown | `user_app_summary` | In dashboard | Could have more detail |
| Audit log details | `audit_logs` | Activity Logs page | Good - already shown |
| Screenshot metadata | `screenshots` | In Reports | Could improve gallery view |

### UX Issues & Improvements

| Issue | Current State | Improvement |
|-------|--------------|-------------|
| **No quick date filters** | User must manually pick start/end dates | Add "Today / This Week / Last 7 Days / This Month" buttons |
| **No auto-refresh** | Dashboard requires manual reload | Use WebSocket (already have infrastructure) to auto-update |
| **Timeline hidden** | Timeline page exists but commented out of sidebar | Enable in sidebar navigation |
| **No "My Day" view** | Regular users see limited data | Create a clean employee self-view page |
| **No trend comparison** | Only shows current period data | Add "vs last week" or "vs last month" comparison |
| **No search in app usage** | Must scroll through apps | Add search/filter in Top Applications table |
| **No browser activity charts** | Only table view for domains | Add pie chart for top domains, bar chart for time by domain |
| **No empty state guidance** | Pages show "No data" without help | Add "Get started" messages with setup instructions |
| **No mobile responsiveness** | Dashboard may break on mobile | Add responsive design for tablets at minimum |
| **No keyboard shortcuts** | All mouse-driven | Add shortcuts for common actions |

### User Flow Issues

| Flow | Problem | Fix |
|------|---------|-----|
| **New org setup** | After register, user lands on empty dashboard with no guidance | Add onboarding wizard |
| **Agent download** | No in-app link to download the agent | Add "Download Agent" button in settings/dashboard |
| **First-time user** | New employee doesn't know what's being tracked | Add "What we track" info panel |
| **Manager view** | Manager sees all users but can't quickly compare | Team comparison page exists but could be more visual |
| **Notification actions** | Notifications show info but no action buttons | Add "View User" or "View Details" links in notifications |

---

## 7. Priority Action Items

### Critical (Do Before Launch)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix partition auto-creation (activity_logs breaks July 2026, app_usage_logs breaks June 2026) | 1 day | System will crash without this |
| 2 | Add billing/subscription system (Stripe/Razorpay) | 1-2 weeks | Can't monetize without it |
| 3 | Add transactional email system (welcome, password reset, alerts) | 3-5 days | Basic SaaS requirement |
| 4 | HTTPS enforcement for production | 1 day | Security requirement |
| 5 | Agent auto-update mechanism | 3-5 days | Can't push fixes to deployed agents |

### High Priority (First Month After Launch)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 6 | Implement hybrid browser tracking (window title fallback) | 2-3 days | Future-proof browser support |
| 7 | Add department/team structure | 3-5 days | Better organization management |
| 8 | Multi-shift support with user-shift assignment | 1 week | Required for 24/7 operations |
| 9 | Quick date filters (Today, This Week, etc.) | 1 day | Major UX improvement |
| 10 | Dashboard auto-refresh via WebSocket | 2 days | Real-time feel |
| 11 | CSV/Excel data export | 2-3 days | Common customer request |
| 12 | New org onboarding wizard | 3 days | Better first-time experience |

### Medium Priority (First Quarter)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 13 | Screenshot blurring option | 3-5 days | Privacy compliance |
| 14 | Two-factor authentication (2FA) | 3 days | Security enhancement |
| 15 | Privacy mode / personal time toggle | 2 days | Employee trust |
| 16 | Data retention settings (auto-delete old data) | 2 days | Storage management |
| 17 | Webhook system for integrations | 1 week | Enables Slack/Teams integration |
| 18 | Weekly email digest for managers | 3 days | Keeps managers engaged |
| 19 | Super admin panel for platform management | 1 week | Multi-org management |
| 20 | API rate limiting per organization | 2 days | Fair usage enforcement |

### Low Priority (Future Roadmap)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 21 | Mobile app (iOS/Android) | 2-3 months | Field worker tracking |
| 22 | SSO/SAML integration | 2 weeks | Enterprise sales requirement |
| 23 | Mac agent support | 2-3 weeks | Broader market |
| 24 | Project/task time tracking | 2-3 weeks | Competes with Time Doctor |
| 25 | Live screen viewing | 2 weeks | Enterprise feature |
| 26 | White-labeling | 1 week | Reseller channel |
| 27 | Public API documentation (Swagger) | 3 days | Developer ecosystem |
| 28 | Alert rules engine | 2 weeks | Custom monitoring rules |

---

## Appendix: Technology Stack

### Frontend
- React 18 + Vite
- Tailwind CSS + Shadcn UI (Radix primitives)
- Zustand (state management)
- React Hook Form + Zod (forms/validation)
- Recharts (data visualization)
- Axios (HTTP client)
- Sonner (toast notifications)
- Lucide React (icons)
- date-fns + date-fns-tz (date handling)

### Backend
- Node.js + Express
- PostgreSQL (with table partitioning)
- JWT (authentication)
- Bcrypt (password hashing)
- WebSocket (ws) for real-time
- Multer (file uploads)
- PDFKit (PDF generation)
- Zod (validation)
- Helmet + CORS (security)
- Morgan (logging)
- node-schedule (scheduled tasks)
- express-rate-limit (rate limiting)

### Desktop Agent
- Electron 28
- better-sqlite3 (local storage)
- active-win (active window detection)
- uiohook-napi (keyboard/mouse events)
- screenshot-desktop (screen capture)
- electron-store (config persistence)
- Winston (logging)
- Luxon (date/time handling)
- electron-builder (packaging: NSIS for Windows, AppImage for Linux)

### Browser Extension
- Chromium: Manifest V3 (Chrome, Edge, Brave, Opera)
- Firefox: Manifest V2
- Native Messaging + HTTP fallback
- Background service worker

---

*This document was generated as part of a product analysis for User Monitor v1.0.0.*
