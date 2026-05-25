# Client Logs

All updates to the client application are tracked here.

## 1.1.8 - 2026-05-21
### Changes
- [Bugfix] Users presence grace: **`2 × heartbeat interval + 90s`** before showing offline (matches 3 min agent interval).
- [Bugfix] Periodic presence re-check so status dots update when heartbeats age out.

## 1.1.7 - 2026-05-21
### Changes
- [Bugfix] **Users** presence: **online** only when `is_on_shift` + fresh heartbeat (fixes logged-in agent without shift showing green).
- [Bugfix] WebSocket: handle **`USER_ON_SHIFT`**; stop treating generic **`HEARTBEAT`** as user presence.

## 1.1.6 - 2026-05-21
### Changes
- [Bugfix] Users list: ignore `USER_HEARTBEAT` events without a timestamp (offline signal).

## 1.1.5 - 2026-05-21
### Changes
- [Bugfix] Sidebar **Break Management** hidden when `user.features.is_breaks_enabled` is false (aligned with campaigns).
- [Bugfix] Break pages show disabled message if breaks are off; auth **`/me`** and login include **`is_breaks_enabled`**.

## 1.1.4 - 2026-05-21
### Changes
- [Feature] **Settings**: when breaks are off, org admin configures grace period, max absence, and action (logout / notify manager).
- [Feature] **Super Admin → Organizations**: per-org **Breaks** toggle (like Campaigns).

## 1.1.3 - 2026-05-21
### Changes
- [Feature] **`DateFromToPicker`** — separate **From date** / **To date** inputs (replaces preset dropdown on **Reports** and **App Usage** that always showed “Today”).
- [Bugfix] **App Usage** default range: last 7 days through org timezone “today” (aligned with Reports).

## 1.1.2 - 2026-05-06
### Changes
- [Feature] **Super Admin → Global Settings**: dedicated **Desktop agent (Windows)** card with **`agent_latest_version`**, **`agent_windows_download_url`**, optional MSI URL and release notes; wider inputs / textarea; friendly labels. SSO toggles remain under **Configuration flags**.

## 1.1.1 - 2026-05-01
### Changes
- [Bugfix] **Dashboard** (`/` orgadmin): **7-Day Productivity Trend** footer showed **work + idle** as one number (`totalH`) while **Work Hours** / **Productivity Mix** show **work only** — clarified copy and label each day as **`X.Xh work`** + **`Y.Yh idle`** so totals align with KPIs (e.g. 64.9h vs 71.2h was work vs work+idle).

- [Bugfix] **`dateUtils`**: `utcToLocal` / `getWorkDate` now use **`formatInTimeZone`** (replacing `toZonedTime` + `format` with unreliable `timeZone` option) so wall-clock times and timeline **`pct`** math match PostgreSQL/org TZ (fixes screenshot markers vs sessions).

- [Bugfix] **Activity Timeline** hour axis aligned with lanes: hour labels sit in the same **label column + flex-1 track** grid as Work/Breaks/Apps/Shots so `%` time positions match the header, grid lines, **now** line, and screenshot markers (fixes perceived “past live time” offset).

- [Feature] **Activity Timeline**: **Shots** uses **3 horizontal rows** (time-sorted round-robin + horizontal fan per row) so 100+ markers don’t collapse; taller violet track.

- [Feature] **Activity Timeline**: zoom to **500%**; **≥325%** shows **all** screenshots; **quarter-hour** dashed grid + **HH:mm** labels when zoom ≥ **300%**; **`min-w-0`** on tracks so **Shots**/`pct()` align with Work/Breaks; subsample below “show all” zoom (~**3**/hour at Fit).

- [Bugfix] `/users`: online/offline filtering now uses a **Presence** select synced with `?status=online|offline` via `setSearchParams` (works on direct visits, bookmarks, and dashboard links); Clear resets URL too. Invalid/missing `status` = show all.
- [Feature] `/` dashboard: date picker + **Today** (org calendar, max = org today), passes `date` to stats APIs; copy clarifies historical vs live metrics.
- [Bugfix] Dashboard manager **Logon** column and user **Started at** use **organization** timezone for display (`orgTimezone` from stats) so they match org-based reporting, not each user’s personal `timezone` alone.
- [Feature] Main layout header: left side shows live **Organization** clock (`org_timezone`) and **Your profile** clock (`user.timezone`, fallback org), with IANA id + short zone abbreviation; updates every second; visible from `lg` breakpoint (`HeaderClocks.jsx`).
- [Bugfix] **Org timezone** for UI date defaults: dashboard 7-day trend aligns with server `work_date` keys; `/reports` default range uses `user.org_timezone` (not UTC); timeline **Today** / initial month uses org timezone. After saving org timezone in **Settings**, `refreshUser()` reloads `/auth/me` so `org_timezone` updates without a new login.
- [Bugfix] Settings shift hour selects: normalize `shift_duration` and `org_working_hours` from API (PostgreSQL DECIMAL strings like `9.00`) so Radix Select values match and persist correctly after refresh.
- [Bugfix] `/users` live status: handle WebSocket `USER_HEARTBEAT` events (server event name) so `last_heartbeat` stays fresh and users don’t all flip to offline after a couple minutes without a manual refresh; also rerun the online/offline filter when heartbeat interval loads.
- [Bugfix] Edit User form: use `reset()` with existing user values so all Select controls (role/status/team/timezone, etc.) correctly preselect saved values and you can change password without reselecting fields.
- [Feature] User activity calendar (`CalendarView`): move **Today** to a full-width row above the month navigation (also used on Timeline).

## 1.1.0 - 2026-02-21
### Changes
- [Feature] Implemented dedicated SuperAdmin layout and overview dashboard.
- [Feature] Added SuperAdmin Organization management and Global Settings UI.
- [Feature] Integrated Google, Microsoft, and Apple SSO login flows into the authentication UI.

## 1.0.0 - 2026-02-20
### Changes
- [Feature] Implementation of tabbed interface for `/app-usage`, `/app-categories`, and `/app-mapping`.
- [Feature] Added "Idle Events" report tab and data visualization.
- [Cleanup] Removed "Timeline" link from sidebar.
- [Config] Setup AI logging rules and initialized LOGS.md.

## 0.9.0 - 2026-02-13
### Changes
- [Refactor] Consolidation of application management pages.
- [Bugfix] Corrected Team Comparison statistics to exclude managers from direct report lists.
