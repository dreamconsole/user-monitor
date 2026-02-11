const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { app, BrowserWindow, Tray, Menu, ipcMain, powerSaveBlocker } = require('electron');

// Prevent timer throttling and renderer backgrounding
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// const { machineIdSync } = require('node-machine-id'); // Will use later
const db = require('./db');
let powerSaveId = null;

function startPowerBlocker() {
    if (powerSaveId === null || !powerSaveBlocker.isStarted(powerSaveId)) {
        powerSaveId = powerSaveBlocker.start('prevent-app-suspension');
        console.log('Power Save Blocker started:', powerSaveId);
    }
}

function stopPowerBlocker() {
    if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
        powerSaveBlocker.stop(powerSaveId);
        console.log('Power Save Blocker stopped:', powerSaveId);
        powerSaveId = null;
    }
}

let mainWindow;
let tray = null;
let isQuitting = false;

global.statusUpdateCallback = (status) => {
    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('status-update', status);
    }
};

// Basic ID until we implement Auth service fully
let currentUser = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        resizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For POC simplicity; consider contextIsolation: true with preload for prod
            backgroundThrottling: false
        },
        show: false // Don't show until ready
    });

    // Open DevTools for debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });

    mainWindow.loadFile(path.join(__dirname, 'ui/login.html'));

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

function createTray() {
    // Need an icon file technically, but will try without or use a placeholder if possible.
    // For now, if no icon, Tray might fail or show generic. 
    // Assuming we might need to handle this.
    // tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
    // tray.setToolTip('User Monitor Agent');
    // tray.setContextMenu(Menu.buildFromTemplate([
    //     { label: 'Show', click: () => mainWindow.show() },
    //     { label: 'Quit', click: () => {
    //         isQuitting = true;
    //         app.quit();
    //     }}
    // ]));
}

app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    createWindow();
    // createTray(); // Commented out until we have an icon

    // Check for auto-login
    const authService = require('./services/auth');
    const authInfo = await authService.checkAutoLogin();
    if (authInfo) {
        console.log('Auto-login successful for:', authInfo.user.email);
        // Wait for window to be ready before sending
        mainWindow.once('ready-to-show', () => {
            mainWindow.webContents.send('auto-login-success', authInfo);
            handleLoginSuccess(authInfo.user, authInfo.token);
        });
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

const authService = require('./services/auth');

// IPC handlers for login will go here
ipcMain.on('login-success', (event, { user, token }) => {
    console.log('User logged in:', user);
    handleLoginSuccess(user, token);
});

function handleLoginSuccess(user, token) {
    console.log('--- handleLoginSuccess START ---');
    try {
        const authService = require('./services/auth');
        authService.setUser(user);
        authService.setToken(token);

        currentUser = user;
        // Initialize DB
        console.log('Initializing DB...');
        db.initDB(user.org_id, user.id);
        console.log('DB Initialized.');

        // Don't start tracking automatically anymore
        // Start Syncing (heartbeats)
        console.log('Requiring Sync Service...');
        const syncService = require('./services/sync');
        console.log('Starting Sync Service...');
        syncService.start();
        console.log('Sync Service Started.');

        // mainWindow.hide(); // Don't hide yet, show tracking UI
    } catch (error) {
        console.error('CRITICAL ERROR in handleLoginSuccess:', error);
    }
    console.log('--- handleLoginSuccess END ---');
}

ipcMain.on('start-tracking', () => {
    console.log('Starting tracking...');
    const monitorService = require('./services/monitor');
    monitorService.start();
    startPowerBlocker();
});

ipcMain.on('pause-tracking', (event, breakType) => {
    console.log(`Pausing tracking for break: ${breakType}`);
    const monitorService = require('./services/monitor');
    monitorService.pause(breakType);
    stopPowerBlocker();
});

ipcMain.on('resume-tracking', () => {
    console.log('Resuming tracking...');
    const monitorService = require('./services/monitor');
    monitorService.resume();
    startPowerBlocker();
});

ipcMain.on('end-shift', () => {
    console.log('Ending shift...');
    const monitorService = require('./services/monitor');
    monitorService.stop();
    stopPowerBlocker();
});

ipcMain.on('logout', () => {
    performLogout();
});

function performLogout() {
    console.log('Logging out...');

    // Stop services
    try {
        const monitorService = require('./services/monitor');
        monitorService.stop();

        const syncService = require('./services/sync');
        syncService.stop();

        const authService = require('./services/auth');
        authService.logout();
    } catch (e) {
        console.error('Error stopping services during logout:', e);
    }

    currentUser = null;

    // Instead of relaunch (which exits process), just reload window to login screen
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(path.join(__dirname, 'ui/login.html'));
        mainWindow.show();
        console.log('Reloaded to login screen.');
    } else {
        // Fallback if window is gone
        app.relaunch();
        app.exit();
    }
}

app.on('force-logout', () => {
    console.log('Received force-logout event from service.');
    performLogout();
});

ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
});
