# 🛡️ User Monitor System

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-Latest-lightgrey.svg)](https://www.electronjs.org/)

A professional, enterprise-grade multi-tenant platform for user productivity tracking and activity monitoring. Designed for transparency and efficiency in remote and hybrid work environments.

---

## 🌟 Key Components

The system architecture is divided into three specialized modules:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend API** | Node.js, Express, PostgreSQL | Core logic, Auth, and Data Management |
| **Control Dashboard** | React 19, Vite, Tailwind | Management interface and Reporting |
| **Desktop Agent** | Electron, OS Hooks | Activity tracking and Screenshot capture |

---

## 📂 Repository Structure

```text
user-monitor/
├── client/           # React + Vite Frontend Dashboard
├── server/           # Node.js + Express API Backend
├── electron-agent/   # Cross-platform Desktop Tracking Agent
├── browser-extension/# Browser-specific tracking tools
└── start.sh          # Unified startup script for development
```

---

## 🛠️ Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18.x or higher)
- **PostgreSQL** (Running instance)
- **NPM** or **Yarn**

### 2. Backend Installation
```bash
cd server
npm install
cp .env.example .env # Configure your DB_URL and JWT_SECRET
npm run seed        # Initialize schema and seed data
npm run dev         # Launch API server
```

### 3. Frontend Installation
```bash
cd client
npm install
npm run dev         # Launch dashboard on localhost:5173
```

### 4. Desktop Agent Installation
```bash
cd electron-agent
npm install
npm start           # Launch tracking agent
```

---

## 🏗️ Tech Stack & Tools

### Frontend & UI
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS & Framer Motion
- **Components**: Shadcn/UI & Lucide Icons

### Backend & Database
- **Runtime**: Node.js & Express
- **Database**: PostgreSQL (Prisma/SQL)
- **Security**: JWT & Bcrypt

### Desktop Integration
- **Platform**: Electron
- **Hooks**: `desktop-idle`, `active-win`, `screenshot-desktop`

---

## 📦 Production Builds

### Desktop Agent (`electron-agent/`)

Run commands **inside** `electron-agent` after `npm install` (and `npx electron-rebuild -f` if native modules complain):

| Script | Output | Use on |
|--------|--------|--------|
| `npm run dist:win` | **Setup `.exe`** (NSIS) + `latest.yml` / blockmap | **Linux or Windows** |
| `npm run dist:win:nsis` | Same as `dist:win` | Linux or Windows |
| `npm run dist:win:msi` | **`.msi`** installer only | **Windows** (WiX; unreliable on Linux/Wine) |
| `npm run dist:win:all` | **`.exe` + `.msi`** | **Windows** only |
| `npm run dist:linux` | Linux `.AppImage` | Linux |

Artifacts land in `electron-agent/dist/`.

**Updates for installed agents** use **`global_settings`** (Super Admin → **Global Settings**): **Agent latest version**, **Windows installer URL (.exe)**, optional MSI URL and release notes. Those feed **`GET /agent/update-info`** (legacy **`AGENT_UPDATE_*`** env vars still apply only when a DB field is empty). Host the **`.exe`** on your CDN (**HTTPS**). On **Windows**, the agent downloads in-app and runs the installer; elsewhere it opens the URL in the browser.

**CI build (Windows installers as artifacts)**

1. Push tag **`agent-v*`** (e.g. `agent-v1.2.0`) so **`.github/workflows/electron-agent-release.yml`** builds **NSIS + MSI** (`--publish never`) and uploads **`dist/*.exe`** and **`latest.yml`** as workflow artifacts.
2. Or build locally from `electron-agent/` and distribute installers yourself.

More detail: [`electron-agent/README.md`](electron-agent/README.md) and [`docs/reports/electron-agent-msi-build-notes.md`](docs/reports/electron-agent-msi-build-notes.md).

### Web Dashboard (`client/`)
```bash
cd client
npm run build       # Optimized production bundle
```

---

## 📄 License
This project is licensed under the **ISC License**. Created for professional monitoring and productivity analysis.

