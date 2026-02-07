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
