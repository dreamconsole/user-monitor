# Server Logs

All updates to the server application are tracked here.

## 1.2.10 - 2026-05-21
### Changes
- [Bugfix] **`POST /auth/login`**, **`POST /auth/register-org`**, **`POST /auth/sso/verify`** — include **`org_name`** in the user payload (sidebar showed org name only after refresh via `/auth/me`).
- [Bugfix] **`POST /superadmin/orgs`** — create org admin with `full_name` / `password_hash` (was legacy `name` / `password` columns, causing 500).
- [Bugfix] **`PUT /superadmin/orgs/:id`** — update `name`, `domain`, and `timezone` (edit form fields were ignored).
- [Bugfix] **`GET /superadmin/orgs`** — include `timezone` in list response for edit UI.

## 1.2.9 - 2026-05-12
### Changes
- [Bugfix] **`GET /agent/update-info`** is registered on **`routes/agent.js`** **before** **`router.use(authenticateToken)`**, so it stays public even when only the **`/agent`** mount is used (avoids 401 **`Null token`**). Removed duplicate **`app.get`** from **`index.js`**.

## 1.2.8 - 2026-05-06
### Changes
- [Feature] Agent update manifest (**`GET /agent/update-info`**, **`GET /update`** → **`agentUpdate`**) reads **`global_settings`**: **`agent_latest_version`**, **`agent_windows_download_url`**, optional **`agent_windows_download_url_msi`**, **`agent_update_release_notes`**. Legacy **`AGENT_UPDATE_*`** env vars still override when a DB value is empty. Migration **`013_agent_update_global_settings.js`** inserts new keys.
- [Refactor] **`fetchAgentUpdateManifest()`** async in **`agentUpdateInfoController.js`**; **`configurationHint`** references Super Admin UI.

## 1.2.7 - 2026-05-06
### Changes
- [Feature] **`agentUpdate.configurationHint`** — when **`configured`** is false, explains missing **`AGENT_UPDATE_*`** env vars (requires non-empty **`AGENT_UPDATE_LATEST_VERSION`** and **`AGENT_UPDATE_DOWNLOAD_URL`**).

## 1.2.6 - 2026-05-06
### Changes
- [Feature] **`GET /update`** — response now includes **`agentUpdate`**: same installer metadata as **`GET /agent/update-info`** (`configured`, `latestVersion`, `downloadUrl`, optional **`downloadUrlMsi`** from **`AGENT_UPDATE_DOWNLOAD_URL_MSI`**). Shared helper `getAgentUpdateManifest()` in `agentUpdateInfoController.js`.

## 1.2.5 - 2026-05-06
### Changes
- [Feature] **`GET /agent/update-info`** — public JSON for desktop agents: `latestVersion`, `downloadUrl`, optional `releaseNotes` from **`AGENT_UPDATE_LATEST_VERSION`**, **`AGENT_UPDATE_DOWNLOAD_URL`**, **`AGENT_UPDATE_RELEASE_NOTES`**. Registered before authenticated `/agent` routes. Controller: `server/src/controllers/agentUpdateInfoController.js`.

## 1.2.4 - 2026-05-06
### Changes
- [Feature] **`GET /update`** — deployment / update diagnostics: API `package.json` version, Node/OS uptime details, **sanitized** `process.env` (secrets/tokens/DB URLs redacted), filesystem paths (`serverRoot`, `.env`, `uploads`, entry script), optional **`electron-agent`** version when `../electron-agent/package.json` exists. Router: `server/src/routes/update.js`.

## 1.2.3 - 2026-05-06
### Changes
- [Feature] `logHeartbeat`: set `users.force_logout` when enforcing max shift + 30m idle, daily **break** limit exceeded + 30m idle (`break_exceeded_action = logout`), and org idle-action logout—so CRM `force_logout` matches agent kick.
- [Bugfix] Break limit with org action **logout**: removed immediate `force_logout` from `checkAndNotifyBreakViolation`; logout now follows the same **idle ≥ 30 minutes** rule via heartbeat as shift cap.

## 1.2.2 - 2026-05-05
### Changes
- [Bugfix] Admin/manager dashboard `statusDistribution` online/offline: use the same **5-minute** `last_heartbeat` window as `activeUsers` (agent session heartbeats). The previous 2-minute window made “Real-time Workforce Status” show far fewer online users than the “Active Now” KPI when the agent heartbeat interval is 5 minutes.

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
