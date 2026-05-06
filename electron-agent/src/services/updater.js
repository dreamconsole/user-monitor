/**
 * GitHub Releases auto-update (electron-updater).
 * Requires packaged app + publish config in package.json (owner/repo).
 * Windows: NSIS build provides latest.yml for updates; MSI can be attached for manual installs.
 */
const { autoUpdater } = require('electron-updater');
const { app, Notification } = require('electron');

let mainWindowRef = null;
/** @type {{ phase: string, remoteVersion?: string, message?: string, appVersion?: string }} */
let lastState = { phase: 'idle' };

function send(channel, payload) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(channel, payload);
    }
}

/**
 * @param {import('electron').BrowserWindow} mainWindow
 */
function initUpdater(mainWindow) {
    mainWindowRef = mainWindow;
    lastState = { phase: 'idle', appVersion: app.getVersion() };

    if (!app.isPackaged) {
        console.log('[Updater] Disabled (not packaged — run a built installer to test updates).');
        return getStubApi();
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
        lastState = { phase: 'checking', appVersion: app.getVersion() };
        send('update-status', { phase: 'checking', appVersion: app.getVersion() });
    });

    autoUpdater.on('update-available', (info) => {
        lastState = {
            phase: 'available',
            remoteVersion: info.version,
            appVersion: app.getVersion()
        };
        send('update-status', {
            phase: 'available',
            version: info.version,
            appVersion: app.getVersion()
        });
        if (Notification.isSupported()) {
            try {
                const n = new Notification({
                    title: 'Update available',
                    body: `User Monitor Agent ${info.version} is downloading in the background.`
                });
                n.show();
            } catch (_) { /* ignore */ }
        }
    });

    autoUpdater.on('update-not-available', () => {
        lastState = { phase: 'current', appVersion: app.getVersion() };
        send('update-status', { phase: 'current', appVersion: app.getVersion() });
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater]', err);
        lastState = { phase: 'error', message: err.message, appVersion: app.getVersion() };
        send('update-status', { phase: 'error', message: err.message, appVersion: app.getVersion() });
    });

    autoUpdater.on('download-progress', (p) => {
        send('update-download-progress', {
            percent: p.percent,
            transferred: p.transferred,
            total: p.total
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        lastState = {
            phase: 'downloaded',
            remoteVersion: info.version,
            appVersion: app.getVersion()
        };
        send('update-status', {
            phase: 'downloaded',
            version: info.version,
            appVersion: app.getVersion()
        });
        if (Notification.isSupported()) {
            try {
                const n = new Notification({
                    title: 'Update ready',
                    body: `Version ${info.version} downloaded. Click Update → Restart to apply.`
                });
                n.show();
            } catch (_) { /* ignore */ }
        }
    });

    const runCheck = () => {
        autoUpdater.checkForUpdates().catch((e) => {
            console.warn('[Updater] checkForUpdates:', e.message);
        });
    };

    setTimeout(runCheck, 12000);
    setInterval(runCheck, 6 * 60 * 60 * 1000);

    return {
        checkForUpdates: () => autoUpdater.checkForUpdates(),
        quitAndInstall: () => autoUpdater.quitAndInstall(false, true),
        getState: () => ({ ...lastState })
    };
}

function getStubApi() {
    return {
        checkForUpdates: async () => Promise.resolve(),
        quitAndInstall: () => {},
        getState: () => ({ phase: 'dev', appVersion: app.getVersion() })
    };
}

module.exports = { initUpdater };
