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

### Windows

**On Linux (Ubuntu, etc.):** `npm run dist:win` builds **NSIS only** (`.exe` + `latest.yml`) so Wine does not run the WiX MSI step that breaks with `LGHT0001`.

```bash
npm run dist:win
```

Same as `npm run dist:win:nsis`. Output: `dist/User Monitor Agent Setup <version>.exe` plus `latest.yml` (auto-update).

**MSI (`.msi`):** Not part of default `dist:win` on purpose. On **Windows**: `npm run dist:win:msi` or `npm run dist:win:all` (NSIS + MSI). **GitHub Actions** publishes both — see `.github/workflows/electron-agent-release.yml`. Details: `docs/reports/electron-agent-msi-build-notes.md`.

### Linux (.AppImage)
```bash
npm run dist:linux
```

The output files will be in the `dist/` folder.

### Auto-update (Windows)

The agent compares its **semver** (`app.getVersion()`) to **`GET {API_URL}/agent/update-info`** on your API server (same base URL as login). Values come from **Super Admin → Global Settings** (`global_settings`): **Agent latest version**, **Windows installer URL**, optional MSI URL and release notes. Legacy **`AGENT_UPDATE_*`** env vars on the API server only apply when the matching DB field is empty.

If the server version is newer, the caption bar shows **Download**. On **Windows**, the agent downloads the **HTTPS** installer to a temp file (progress shown), then **starts the installer** so the user can complete setup (NSIS may ask to close the running app). On **Linux/macOS**, the download URL opens in the browser. There is no GitHub Releases requirement for this flow.

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

3. GitHub Actions workflow **`Electron Agent (Windows) Release`** (`.github/workflows/electron-agent-release.yml`) builds on **windows-latest**, runs `electron-builder` (**NSIS + MSI**, `--publish never`), and uploads **`dist/*.exe`** and **`latest.yml`** as workflow artifacts. Host the installer on your CDN, then enter version + URLs in **Super Admin → Global Settings**.

**Local Windows build** (no artifact upload):

```bash
cd electron-agent
npm run release:win
```

### In-app behavior

- Top caption bar **Update** checks **`/agent/update-info`**; when a newer **`latestVersion`** is configured, the button becomes **Download** (green).
- **Windows**: **Download** streams the **`.exe`** in-app, shows **%**, then launches the installer.
- **Other OS**: **Download** opens **`downloadUrl`** in the default browser.
- OS notifications fire once per remote version when an update is **available**, and when the installer process is started on Windows.

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
