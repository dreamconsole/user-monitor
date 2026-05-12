# Agent Logs

All updates to the electron-agent are tracked here.

## 1.2.8 - 2026-05-12
### Changes
- [Feature] **Updater DevTools visibility**: `GET …/agent/update-info` runs in the **main process** (axios), so it does **not** appear under the renderer **Network** tab. The UI now logs **`[Updater]`** lines to the **Console** (button click, IPC status, throttled download %). Update IPC payloads include **`manifestUrl`** while checking / on errors so you can confirm the target URL.

## 1.2.7 - 2026-05-12
### Changes
- [Feature] **Developer Tools**: open detached DevTools on launch when running **from source** (`!app.isPackaged`), when `NODE_ENV=development`, or when `USER_MONITOR_DEVTOOLS=1`. **F12**, **Ctrl+Shift+I** (Linux/Windows), or **Cmd+Option+I** (macOS) toggles DevTools in the main window (useful for Network tab / update IPC while the app menu is hidden).

## 1.2.6 - 2026-05-06
### Changes
- [Config] README: agent **`downloadUrl`** source is **Super Admin `global_settings`** (not env-only); optional legacy **`AGENT_UPDATE_*`** fallback documented.

## 1.2.5 - 2026-05-06
### Changes
- [Feature] **In-app installer download (Windows)**: **`Download`** saves **`AGENT_UPDATE_DOWNLOAD_URL`** to temp, shows **%** progress, then **runs the `.exe`** (detached). Non-Windows still opens the URL in the browser. HTTPS required for download; **`install_launched`** UI state after spawn.

## 1.2.4 - 2026-05-06
### Changes
- [Feature] **Updates via server API**: removed **`electron-updater`** / GitHub Releases. Agent calls **`GET {API_URL}/agent/update-info`**, compares semver with **`semver`**, caption bar shows **Download** for newer **`latestVersion`**. Periodic check ~12s after startup + every 6h. **`release:win`** / **`build.publish`** no longer target GitHub; CI workflow uploads **`dist/*.exe`** + **`latest.yml`** as artifacts.
- [Config] **`server/.env.example`**: documented **`AGENT_UPDATE_*`** vars for the update manifest endpoint.

## 1.2.3 - 2026-05-06
### Changes
- [Config] Root [`README.md`](../README.md): Desktop Agent production builds — script table (`dist:win`, `dist:win:msi`, `dist:win:all`), run from `electron-agent/`, GitHub Release / tag / Actions notes; links to `electron-agent/README.md` and MSI/Wine doc.

## 1.2.2 - 2026-05-06
### Changes
- [Config] Default **`dist:win`** / **`release:win`** build **NSIS only** (`package.json` `win.target` NSIS-only). Dual NSIS+MSI in config caused WiX/MSI to run on Linux and fail (`LGHT0001`), aborting the whole command so no new `.exe` was produced. **`dist:win:all`** = NSIS+MSI (Windows). CI workflow builds **`nsis:x64` + `msi:x64`** explicitly on `windows-latest`.

## 1.2.1 - 2026-05-06
### Changes
- [Config] Scripts `dist:win:nsis` and explicit `dist:win:msi`; README + `docs/reports/electron-agent-msi-build-notes.md`: MSI via WiX fails on Ubuntu/Wine (`LGHT0001`); use NSIS on Linux or build MSI on Windows / GitHub Actions.

## 1.2.0 - 2026-05-06
### Changes
- [Feature] **Auto-update**: `electron-updater` + GitHub Releases (`publish`: dreamconsole/user-monitor). Caption bar **Update** button (check / progress / **Restart** when downloaded); OS notifications when an update is available and when ready to install. Periodic check after startup + every 6h (packaged builds only).
- [Feature] Windows build outputs **NSIS** (auto-update channel) + **MSI** (`npm run dist:win`). Script `npm run release:win` publishes to GitHub when `GH_TOKEN` is set.
- [Feature] GitHub Actions workflow `.github/workflows/electron-agent-release.yml`: tag `agent-v*` → Windows build + `electron-builder --publish always`.
- [Feature] Footer shows live **`app.getVersion()`** via `get-app-version` IPC.

## 1.1.9 - 2026-05-06
### Changes
- [Feature] **Minimize-only window chrome**: `frame: false` so Linux WMs cannot show a native close (X); slim **caption bar** (title + single minimize) and `window-minimize` IPC. Branded header remains draggable on the left block.

## 1.1.8 - 2026-05-06
### Changes
- [Feature] Restore **native OS title bar** (`frame` default); **`closable: false`** to drop the close (X) control; **`minimizable: true`** for standard minimize. Removed frameless workaround and in-header minimize button.

## 1.1.7 - 2026-05-06
### Changes
- [Feature] Frameless window: header **Minimize** button (`window-minimize` IPC → `mainWindow.minimize()`); no native close control.

## 1.1.6 - 2026-05-06
### Changes
- [Bugfix] Hide native window close/min/max: set `frame: false` on `BrowserWindow` (Linux WMs often still show “X” when only `closable: false`). In-app header remains draggable via existing `-webkit-app-region: drag`.

## 1.1.5 - 2026-05-06
### Changes
- [Feature] Single open break: `pause()` rejects a second break while already on break; closes orphaned local `break_logs` with `end_time IS NULL` before starting a new break (crash / sync gaps). `pause-tracking` is an IPC `invoke` returning `{ ok, reason }`; UI shows a notification if start fails.
- [Feature] Main window **closable: false** (no title-bar close control); minimize-to-tray behavior unchanged (`close` still hides).
- [Bugfix] Declare `selectedBreakName` in `login.js` (was an accidental global).

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
