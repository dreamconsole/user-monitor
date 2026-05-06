# User Monitor Agent

This is the desktop agent for the User Monitor system. It tracks user activity (Active/AFK) and captures screenshots.

## Prerequisites

- Node.js (v16 or higher)
- NPM

## Installation

1. Navigate to this directory:
   ```bash
   cd electron-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   *Note: On Linux, you may need build tools for native modules: `sudo apt-get install build-essential libxtst-dev libpng++-dev pkg-config`.*

3. **Rebuild native modules for Electron** (required after install; fixes "invalid ELF header" / better_sqlite3.node errors):
   ```bash
   npx electron-rebuild -f
   ```
   Wait for it to finish (2–5 minutes); it compiles `better-sqlite3` and other native addons for Electron’s Node runtime.

## Running the Agent

### Development Mode
To start the agent specifically:
```bash
npm start
```

## Configuration

- **API endpoint**: Create a `.env` file in the `electron-agent` folder (copy from `.env.example`) and set the server URL:
  ```bash
  cp .env.example .env
  ```
  Edit `.env` and set:
  ```env
  API_URL=https://user-monitor.onrender.com
  ```
  If no `.env` exists or `API_URL` is not set, the agent falls back to `http://localhost:3000`.
- Data is stored in your OS user data directory (e.g., `~/.config/user-monitor-agent/agent-data` or similar, depending on Electron's `userData` path resolution).

## Features

- **Login**: Authenticates with the backend.
- **Monitoring**: Detects idle time (5 minutes threshold).
- **Screenshots**: Captures screen every 10 minutes if active.
- **Sync**: Uploads data to the backend every 30 seconds.

## Building Executables

### Windows (.exe)
To build a Windows installer and executable:

```bash
npm run dist:win
```

*Note: You can run this command on Linux to cross-compile for Windows (requires Wine to be installed), but it is recommended to run this on a Windows machine for best compatibility.*

### Linux (.AppImage)
```bash
npm run dist:linux
```

The output files will be in the `dist/` folder.

### Auto-update (Windows)

The installed agent checks **GitHub Releases** on this repo (`dreamconsole/user-monitor`) for a newer version than `package.json` / the built app.

- **How it works**: `electron-updater` downloads updates using the **NSIS** installer metadata (`latest.yml` + `.exe`). The **MSI** is optional for manual / IT installs; in-place auto-update follows the NSIS channel.
- **Who gets updates**: Users who installed from the published **Setup .exe** (NSIS). Bump `electron-agent/package.json` `version`, build, and publish a GitHub Release containing the new artifacts.
- **Development**: `npm start` is **not** packaged — the Update button explains that updates apply only to installed builds.

### Publishing a Windows release (CI)

1. Bump the agent version in `electron-agent/package.json` (or rely on the workflow overwrite — see below).
2. Create and push an annotated tag (recommended):

   ```bash
   cd electron-agent
   npm version patch   # or set version manually, then:
   git tag agent-v$(node -p "require('./package.json').version")
   git push origin main --tags
   ```

   Tag format must be **`agent-v1.2.3`** (workflow extracts `1.2.3`).

3. GitHub Actions workflow **`Electron Agent (Windows) Release`** (`.github/workflows/electron-agent-release.yml`) builds on **windows-latest**, runs `electron-builder --win --publish always`, and uploads **NSIS**, **MSI**, and update metadata to the Release.

**Manual publish from a Windows machine** (requires `GH_TOKEN` with `repo` scope if the repo is private):

```bash
cd electron-agent
set GH_TOKEN=ghp_xxxx   # Windows CMD; use export on Git/Linux
npm run release:win
```

### In-app behavior

- Top caption bar **Update** runs a manual check; progress shows as a percentage while downloading.
- After download, the button becomes **Restart** (green) — click to install and relaunch.
- OS notifications fire when an update is **available** and when it is **ready to install**.

## Troubleshooting

### "invalid ELF header" / better_sqlite3.node / "Database not initialized" after login

Native modules (`better-sqlite3`, `uiohook-napi`, etc.) must be built for Electron, not for your system Node. After `npm install`, run:

```bash
npx electron-rebuild -f
```

Let the command run to completion (it may take 2–5 minutes). Then start the agent again with `npm start`. If you still see the error, try a clean reinstall:

```bash
rm -rf node_modules
npm install
npx electron-rebuild -f
```
