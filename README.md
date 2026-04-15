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

### Desktop Agent
```bash
# Generate platform-specific installers
npm run dist:win    # For Windows
npm run dist:linux  # For Linux
```

### Web Dashboard
```bash
npm run build       # Optimized production bundle
```

---

## 📄 License
This project is licensed under the **ISC License**. Created for professional monitoring and productivity analysis.

