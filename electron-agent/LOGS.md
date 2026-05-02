# Agent Logs

All updates to the electron-agent are tracked here.

## 1.1.4 - 2026-05-02
### Changes
- [Feature] Agent sends `/agent/heartbeat` only while a work session is active (user on shift). After End Shift, no heartbeats until they start a shift again (logged-in-but-idle no longer appears online).

## 1.1.3 - 2026-05-02
### Changes
- [Bugfix] Start Shift stayed enabled while campaigns were still loading (`hasCampaigns` was false until the API returned), so users could start without an assignment. Track `campaignsLoaded`, disable Start Shift until fetch completes, and require a selection when the org has campaigns.

## 1.1.2 - 2026-05-02
### Changes
- [Bugfix] Login error banner was invisible: submitting the form set `display:none` inline and the catch block only removed Tailwind `hidden`, so wrong-password and API errors never appeared. Use `hidden` class only for show/hide; clearer messages when the server is unreachable.

## 1.1.1 - 2026-05-01
### Changes
- [Feature] Heartbeat sends `shift_cap_idle_seconds` (system/input idle regardless of break) so the server can enforce max shift duration + 30m idle logout while on break.

## 1.1.0 - 2026-02-20
### Changes
- [Feature] Dynamic fetching and application of feature configurations (AFK, screenshots).
- [Feature] Implementation of `force_logout` command handling.
- [Config] Setup AI logging rules and initialized LOGS.md.
- [Cleanup] Moved stray reports to docs/reports and enforced root protection in .cursorrules.

## 1.0.5 - 2026-02-11
### Changes
- [Bugfix] Fixed `total_idle_seconds` calculation during shift ends.
- [Bugfix] Resolved issue where `keyboard_events` and `mouse_events` were recorded as 0.
- [Bugfix] Fixed null `break_type_id` in break logs.
