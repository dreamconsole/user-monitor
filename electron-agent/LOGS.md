# Agent Logs

All updates to the electron-agent are tracked here.

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
