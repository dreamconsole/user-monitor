# Client Logs

All updates to the client application are tracked here.

## 1.1.1 - 2026-05-01
### Changes
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
