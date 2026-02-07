# User Monitor System

A comprehensive, multi-tenant user productivity and activity monitoring system. This project includes a dashboard for managers and employees, a robust backend API, and a desktop agent for activity tracking.

## 🚀 Project Overview

The User Monitor system consists of three main components:

-   **Backend (`/server`)**: A Node.js & Express API powered by PostgreSQL for data management and authentication.
-   **Dashboard (`/client`)**: A modern React + Vite frontend for managing organizations, monitoring employees, and viewing reports.
-   **Desktop Agent (`/electron-agent`)**: A cross-platform Electron application that tracks user activity, idle time, and captures periodic screenshots.

## 📂 Project Structure

```text
user-monitor/
├── client/          # React + Vites Frontend
├── server/          # Node.js API Backend
├── electron-agent/  # Electron Tracking Application
└── start.sh         # Helper script to start services
```

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: Local or remote database instance
- **NPM** or **Yarn**

### 2. Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (create `.env` from `.env.example`):
   ```env
   PORT=3000
   DATABASE_URL=postgres://user:password@localhost:5432/user_monitor
   JWT_SECRET=your_secret_key
   ```
4. Initialize the database and seed data:
   ```bash
   npm run seed
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

### 3. Client Dashboard Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### 4. Desktop Agent Setup
1. Navigate to the agent directory:
   ```bash
   cd electron-agent
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the agent:
   ```bash
   npm start
   ```

---

## ✨ Features

-   **Multi-tenancy**: Organization-based data isolation.
-   **Role-Based Access**: Specialized views for Super Admins, Org Admins, Managers, and Employees.
-   **Real-time Tracking**: Automatically detects active/idle states and tracks active window titles.
-   **Automated Screenshots**: Captures periodic screens for productivity verification.
-   **Interactive Dashboard**:
    -   Live attendance monitoring.
    -   Break management.
    -   Detailed reporting and statistics.
-   **Offline Support**: Agent caches data locally if the server is unreachable.

## 🛠️ Tech Stack

-   **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Shadcn UI.
-   **Backend**: Node.js, Express, PostgreSQL, Multer (file uploads).
-   **Agent**: Electron, `desktop-idle`, `screenshot-desktop`.
-   **Authentication**: JWT (JSON Web Tokens) & Bcrypt password hashing.

---

## 🏗️ Building for Production

### Desktop Agent
To build the agent for different platforms:
```bash
# Windows
npm run dist:win

# Linux
npm run dist:linux
```

### Dashboard
To build the web production bundle:
```bash
npm run build
```

---

## 📄 License
This project is licensed under the ISC License.
