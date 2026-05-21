const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { app, BrowserWindow, Tray, Menu, ipcMain, powerSaveBlocker, Notification } = require('electron');

// Prevent timer throttling and renderer backgrounding
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// const { machineIdSync } = require('node-machine-id'); // Will use later
const db = require('./db');
const { initUpdater } = require('./services/updater');

// Set AppUserModelId for Windows Notifications
if (process.platform === 'win32') {
    app.setAppUserModelId('com.sourcecodekart.sckagent');
}
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
/** @type {ReturnType<typeof initUpdater> | null} */
let updaterCtl = null;

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
        height: 660,
        resizable: false,
        maximizable: false,
        minimizable: true,
        closable: false,
        // Linux (and some setups) ignore closable:false on a framed window — frameless + in-page caption is the reliable “minimize only, no X” layout.
        frame: false,
        icon: path.join(__dirname, '../assets/icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // TODO: migrate to contextIsolation: true with preload script
            backgroundThrottling: false,
            devTools: true
        },
        show: false // Don't show until ready
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const k = String(input.key || '').toLowerCase();
        const toggleKeys =
            k === 'f12' ||
            (input.control && input.shift && k === 'i') ||
            (process.platform === 'darwin' && input.meta && input.alt && k === 'i');
        if (toggleKeys) {
            event.preventDefault();
            mainWindow.webContents.toggleDevTools();
        }
    });

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
    updaterCtl = initUpdater(mainWindow);
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
        console.log('Initializing DB...');
        db.initDB(user.org_id, user.id);
        console.log('DB Initialized.');

        console.log('Requiring Sync Service...');
        const syncService = require('./services/sync');
        console.log('Starting Sync Service...');
        syncService.start();
        console.log('Sync Service Started.');

        // Start browser activity tracking infrastructure
        initBrowserTracking();
    } catch (error) {
        console.error('CRITICAL ERROR in handleLoginSuccess:', error);
    }
    console.log('--- handleLoginSuccess END ---');
}

let knownBrowserKeys = new Set();
let browserRescanInterval = null;
const BROWSER_RESCAN_MS = 6 * 60 * 60 * 1000; // 6 hours

function initBrowserTracking() {
    try {
        const browserActivityService = require('./services/browserActivityService');

        scanAndInstallBrowserExtensions();

        browserActivityService.start();

        // Periodic re-scan for newly installed browsers
        if (!browserRescanInterval) {
            browserRescanInterval = setInterval(() => {
                console.log('[BrowserTracking] Periodic re-scan...');
                scanAndInstallBrowserExtensions();
            }, BROWSER_RESCAN_MS);
        }

        console.log('[BrowserTracking] Initialized successfully (re-scan every 6h)');
    } catch (error) {
        console.error('[BrowserTracking] Init failed (non-fatal):', error.message);
    }
}

function scanAndInstallBrowserExtensions() {
    try {
        const browserDetector = require('./services/browserDetector');
        const extensionInstaller = require('./services/extensionInstaller');

        const browsers = browserDetector.detect();
        const newBrowsers = browsers.filter(b => !knownBrowserKeys.has(b.key));

        if (newBrowsers.length > 0) {
            const isFirstRun = knownBrowserKeys.size === 0;
            console.log(`[BrowserTracking] ${isFirstRun ? 'Initial scan' : 'New browser(s) detected'}: ${newBrowsers.map(b => b.name).join(', ')}`);

            const results = extensionInstaller.installAll(newBrowsers);
            console.log('[BrowserTracking] Install results:', JSON.stringify(results));

            newBrowsers.forEach(b => knownBrowserKeys.add(b.key));
        } else {
            console.log('[BrowserTracking] No new browsers found');
        }
    } catch (error) {
        console.error('[BrowserTracking] Scan/install failed (non-fatal):', error.message);
    }
}

ipcMain.on('start-tracking', (event, data) => {
    console.log('Starting tracking...');
    const campaignId = data?.campaignId || null;
    const monitorService = require('./services/monitor');
    monitorService.start(campaignId);
    startPowerBlocker();
});

ipcMain.handle('pause-tracking', (event, breakType) => {
    console.log(`Pausing tracking for break: ${breakType}`);
    const monitorService = require('./services/monitor');
    const result = monitorService.pause(breakType);
    if (result.ok) {
        stopPowerBlocker();
    }
    return result;
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

ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
        const notif = new Notification({
            title,
            body,
            icon: path.join(__dirname, '../assets/icon.png'),
            silent: false
        });
        notif.show();
        
        notif.on('click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
    }
});

const { dialog } = require('electron');
ipcMain.handle('show-confirm-dialog', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        cancelId: 1,
        title: options.title || 'Confirm',
        message: options.message || 'Are you sure?'
    });
    return response === 0; // Returns true if 'Yes' (index 0) is clicked
});

function performLogout() {
    console.log('Logging out...');

    try {
        const monitorService = require('./services/monitor');
        monitorService.stop();

        const syncService = require('./services/sync');
        syncService.stop();

        const browserActivityService = require('./services/browserActivityService');
        browserActivityService.stop();

        if (browserRescanInterval) {
            clearInterval(browserRescanInterval);
            browserRescanInterval = null;
        }
        knownBrowserKeys.clear();

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

ipcMain.on('window-minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
    }
});

ipcMain.handle('updater-check', async () => {
    if (!updaterCtl) return { ok: false, message: 'Updater not ready' };
    try {
        await updaterCtl.checkForUpdates();
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e.message || String(e) };
    }
});

ipcMain.handle('updater-install', async () => {
    if (!updaterCtl) return { ok: false };
    return updaterCtl.downloadAndInstall();
});

ipcMain.handle('updater-get-state', () => (updaterCtl ? updaterCtl.getState() : { phase: 'unknown' }));

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-breaks', async () => {
    const authService = require('./services/auth');
    return await authService.fetchBreaks();
});

ipcMain.handle('get-campaigns', async () => {
    const authService = require('./services/auth');
    return await authService.fetchCampaigns();
});
