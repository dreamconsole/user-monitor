# Server Logs

All updates to the server application are tracked here.

## 1.2.1 - 2026-05-01
### Changes
- [Config] Global `express-rate-limit`: raised `max` from 1000 to **20000** requests per IP per 30 minutes (`generalLimiter` in `index.js`).
- [Feature] Dashboard date filter: optional query `GET /stats/admin|manager|user?date=YYYY-MM-DD` (org calendar day). Responses include `statsDate` and `isStatsToday`. Work/absent/KPIs and 7-day trend end on that date; agent “active now” and online/offline remain live.
- [Bugfix] Timeline month view: screenshot counts per `work_date` use org TZ on `captured_at` (not `captured_at::date` in DB session TZ). Manager dashboard late-login uses org-local wall time (`Intl`), not server timezone.
- [Bugfix] Reports daily summary (`fetchDailySummaryData`): include `ws.org_id` in `GROUP BY` so the break-seconds correlated subquery no longer triggers PostgreSQL error `column ws.org_id must appear in the GROUP BY clause` (500 on `/reports/summary`).
- [Bugfix] Org **timezone** (`organizations.timezone`) now drives **today** and date ranges for dashboard stats, timeline defaults, productivity defaults, reports (summary/breaks/screenshots/idle), hourly user stats, and break-limit checks—using `(NOW() AT TIME ZONE org_tz)::date` and `work_date` instead of PostgreSQL `CURRENT_DATE` / UTC `DATE(timestamptz)` so orgs like **America/Belize** see the correct calendar day (e.g. April 30 evening while UTC is already May 1).
- [Feature] `logHeartbeat`: after org **User's Max Shift Duration** from today's first check-in (heartbeats / work sessions, org timezone), if elapsed time is past the cap **and** idle ≥ 30 minutes (`shift_cap_idle_seconds` or fallback `current_idle_time`), respond with `FORCE_LOGOUT` (includes **on break** when agent sends raw idle).
- [Bugfix] Reports `breaks` tab: include untyped breaks (`break_type_id` NULL) by left-joining `break_master` and falling back to `Unassigned`, so these rows appear in `/reports/breaks`.
- [Bugfix] Team comparison / productivity score: when a user has **no logged work** in the range (`total_work_seconds === 0`), score **activity**, **breaks**, and **app usage** as **0** instead of defaulting to 100% (which produced ~70 "Good" with 0% attendance).
- [Feature] Multi-team managers/org admins: added `team_manager_links` (migration `012_team_manager_links.js`); assigning a **manager** or **orgadmin** to another team no longer overwrites `users.team_id`. Team member lists, manager listings, and manager-scoped APIs use **all** linked teams plus primary `team_id`.

## 1.2.0 - 2026-02-21
### Changes
- [Feature] Added `superadmin` role with dedicated API endpoints for health, org management, and global settings.
- [Feature] Implemented SSO token verification and authentication flow for Google, Microsoft, and Apple providers.
- [Refactor] Updated authentication middleware to support role-based route guarding.
- [Config] Added Microsoft and Apple client ID environment variables.

## 1.1.0 - 2026-02-20
### Changes
- [Feature] Added `fetch_features` endpoint for dynamic agent configuration.
- [Feature] Implementation of Idle Events tracking and reporting API.
- [Config] Setup AI logging rules and initialized LOGS.md.

## 1.0.5 - 2026-02-14
### Changes
- [Refactor] Optimized shop context resolution in `shopGuard.ts`.
- [Bugfix] Resolved infinite dashboard reload loop.
