/**
 * Agent updates via server API: GET {API_URL}/agent/update-info
 * (no GitHub). When remote latestVersion > app version, user can download the installer
 * in-app and run it (Windows .exe); other platforms fall back to opening downloadUrl.
 */
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const axios = require('axios');
const semver = require('semver');
const { app, Notification, shell } = require('electron');
const { spawn } = require('child_process');
const { API_URL } = require('../config');

let mainWindowRef = null;
/** @type {{ phase: string, remoteVersion?: string, downloadUrl?: string, message?: string, appVersion?: string }} */
let lastState = { phase: 'idle' };
let notifiedForVersion = null;
let downloadInProgress = false;

function send(channel, payload) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(channel, payload);
    }
}

async function fetchUpdateManifest() {
    const url = `${API_URL.replace(/\/$/, '')}/agent/update-info`;
    const response = await axios.get(url, { timeout: 20000 });
    return response.data;
}

/**
 * Download installer to temp and launch it (Windows NSIS .exe).
 * @param {string} downloadUrl
 * @param {string} remoteVersion
 */
async function downloadAndRunInstaller(downloadUrl, remoteVersion) {
    if (downloadInProgress) {
        return { ok: false, message: 'Download already in progress' };
    }

    if (!downloadUrl || typeof downloadUrl !== 'string') {
        return { ok: false, message: 'No download URL' };
    }

    if (process.platform !== 'win32') {
        if (/^https?:\/\//i.test(downloadUrl)) {
            shell.openExternal(downloadUrl);
            return { ok: true, fallback: 'browser' };
        }
        return { ok: false, message: 'Invalid download URL' };
    }

    if (!/^https:\/\//i.test(downloadUrl)) {
        return { ok: false, message: 'Download URL must use HTTPS' };
    }

    downloadInProgress = true;
    lastState = { ...lastState, phase: 'downloading', appVersion: app.getVersion() };
    send('update-status', { phase: 'downloading', version: remoteVersion, appVersion: app.getVersion() });
    send('update-download-progress', { percent: 0 });

    const tmpDir = app.getPath('temp');
    const safeVer = String(remoteVersion || 'update').replace(/[^0-9.a-zA-Z_-]/g, '_');
    const destPath = path.join(tmpDir, `UserMonitorAgent-setup-${safeVer}.exe`);

    try {
        if (fs.existsSync(destPath)) {
            try {
                fs.unlinkSync(destPath);
            } catch (_) { /* replace below */ }
        }

        const response = await axios.get(downloadUrl, {
            responseType: 'stream',
            timeout: 0,
            maxRedirects: 5,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: (s) => s >= 200 && s < 300
        });

        const total = parseInt(response.headers['content-length'] || '0', 10);
        let loaded = 0;
        const writer = fs.createWriteStream(destPath);

        response.data.on('data', (chunk) => {
            loaded += chunk.length;
            if (total > 0) {
                const percent = Math.min(100, Math.round((loaded / total) * 100));
                send('update-download-progress', { percent });
            }
        });

        await pipeline(response.data, writer);

        const stat = fs.statSync(destPath);
        if (stat.size < 64 * 1024) {
            try {
                fs.unlinkSync(destPath);
            } catch (_) { /* ignore */ }
            throw new Error('Downloaded file is too small or corrupt');
        }

        send('update-download-progress', { percent: 100 });

        const child = spawn(destPath, [], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        lastState = {
            ...lastState,
            phase: 'install_launched',
            remoteVersion,
            downloadUrl,
            appVersion: app.getVersion()
        };
        send('update-status', {
            phase: 'install_launched',
            version: remoteVersion,
            appVersion: app.getVersion()
        });

        if (Notification.isSupported()) {
            try {
                new Notification({
                    title: 'Installer started',
                    body: 'Complete the steps in the setup wizard to finish updating.'
                }).show();
            } catch (_) { /* ignore */ }
        }

        return { ok: true };
    } catch (err) {
        console.warn('[Updater] download/install', err.message);
        try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        } catch (_) { /* ignore */ }

        lastState = {
            phase: 'error',
            message: err.message || 'Download failed',
            appVersion: app.getVersion(),
            remoteVersion,
            downloadUrl
        };
        send('update-status', {
            phase: 'error',
            message: lastState.message,
            appVersion: app.getVersion()
        });
        return { ok: false, message: lastState.message };
    } finally {
        downloadInProgress = false;
    }
}

/**
 * @param {import('electron').BrowserWindow} mainWindow
 */
function initUpdater(mainWindow) {
    mainWindowRef = mainWindow;
    lastState = { phase: 'idle', appVersion: app.getVersion() };

    const runCheck = async () => {
        if (downloadInProgress) return;

        const manifestUrl = `${API_URL.replace(/\/$/, '')}/agent/update-info`;
        console.info('[Updater] GET', manifestUrl);
        lastState = { phase: 'checking', appVersion: app.getVersion(), manifestUrl };
        send('update-status', { phase: 'checking', appVersion: app.getVersion(), manifestUrl });

        try {
            const data = await fetchUpdateManifest();

            if (!data.success || !data.configured || !data.latestVersion || !data.downloadUrl) {
                lastState = { phase: 'current', appVersion: app.getVersion() };
                send('update-status', { phase: 'current', appVersion: app.getVersion() });
                return;
            }

            const remote = String(data.latestVersion).trim();
            const local = app.getVersion();

            if (!semver.valid(remote)) {
                console.warn('[Updater] Invalid semver from server:', remote);
                lastState = { phase: 'error', message: 'Invalid version from server', appVersion: local };
                send('update-status', {
                    phase: 'error',
                    message: lastState.message,
                    appVersion: local,
                    manifestUrl
                });
                return;
            }

            const localCoerced = semver.valid(local) ? local : semver.coerce(local)?.version || local;
            if (!semver.valid(localCoerced)) {
                lastState = { phase: 'current', appVersion: local };
                send('update-status', { phase: 'current', appVersion: local });
                return;
            }

            if (semver.gt(remote, localCoerced)) {
                lastState = {
                    phase: 'available',
                    remoteVersion: remote,
                    downloadUrl: data.downloadUrl,
                    appVersion: local,
                    releaseNotes: data.releaseNotes || ''
                };
                send('update-status', {
                    phase: 'available',
                    version: remote,
                    downloadUrl: data.downloadUrl,
                    appVersion: local
                });

                if (notifiedForVersion !== remote && Notification.isSupported()) {
                    notifiedForVersion = remote;
                    try {
                        new Notification({
                            title: 'Update available',
                            body: `User Monitor Agent ${remote} is available. Click Update → Download.`
                        }).show();
                    } catch (_) { /* ignore */ }
                }
            } else {
                lastState = { phase: 'current', appVersion: local };
                send('update-status', { phase: 'current', appVersion: local });
            }
        } catch (err) {
            console.warn('[Updater]', err.message);
            lastState = {
                phase: 'error',
                message: err.response?.data?.error || err.message || 'Update check failed',
                appVersion: app.getVersion()
            };
            send('update-status', {
                phase: 'error',
                message: lastState.message,
                appVersion: app.getVersion(),
                manifestUrl
            });
        }
    };

    setTimeout(runCheck, 12000);
    setInterval(runCheck, 6 * 60 * 60 * 1000);

    return {
        checkForUpdates: runCheck,
        downloadAndInstall: () => {
            const url = lastState.downloadUrl;
            const ver = lastState.remoteVersion;
            if (!url || !ver) return Promise.resolve({ ok: false, message: 'No update pending' });
            return downloadAndRunInstaller(url, ver);
        },
        getState: () => ({ ...lastState })
    };
}

module.exports = { initUpdater };
