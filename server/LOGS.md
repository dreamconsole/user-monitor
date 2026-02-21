# Server Logs

All updates to the server application are tracked here.

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
