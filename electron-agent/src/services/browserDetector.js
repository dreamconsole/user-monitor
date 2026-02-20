/**
 * BrowserDetector -- detects installed browsers on Windows and Linux.
 * Returns an array of detected browser objects with name, type, and paths.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BROWSERS = {
    chrome: {
        name: 'Google Chrome',
        type: 'chromium',
        windows: {
            paths: [
                path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
            ],
            registryKey: 'HKLM\\SOFTWARE\\Google\\Chrome\\BLBeacon'
        },
        linux: {
            binaries: ['google-chrome', 'google-chrome-stable'],
            paths: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome']
        }
    },
    edge: {
        name: 'Microsoft Edge',
        type: 'chromium',
        windows: {
            paths: [
                path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
            ],
            registryKey: 'HKLM\\SOFTWARE\\Microsoft\\Edge\\BLBeacon'
        },
        linux: {
            binaries: ['microsoft-edge', 'microsoft-edge-stable'],
            paths: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/opt/microsoft/msedge/msedge']
        }
    },
    brave: {
        name: 'Brave',
        type: 'chromium',
        windows: {
            paths: [
                path.join(process.env.PROGRAMFILES || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
                path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
            ],
            registryKey: 'HKLM\\SOFTWARE\\BraveSoftware\\Brave-Browser\\BLBeacon'
        },
        linux: {
            binaries: ['brave-browser', 'brave-browser-stable'],
            paths: ['/usr/bin/brave-browser', '/usr/bin/brave-browser-stable', '/opt/brave.com/brave/brave']
        }
    },
    opera: {
        name: 'Opera',
        type: 'chromium',
        windows: {
            paths: [
                path.join(process.env.PROGRAMFILES || '', 'Opera', 'opera.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || '', 'Opera', 'opera.exe'),
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Opera', 'opera.exe'),
                path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable', 'opera.exe')
            ]
        },
        linux: {
            binaries: ['opera'],
            paths: ['/usr/bin/opera', '/usr/lib/x86_64-linux-gnu/opera/opera']
        }
    },
    firefox: {
        name: 'Mozilla Firefox',
        type: 'firefox',
        windows: {
            paths: [
                path.join(process.env.PROGRAMFILES || '', 'Mozilla Firefox', 'firefox.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || '', 'Mozilla Firefox', 'firefox.exe')
            ],
            registryKey: 'HKLM\\SOFTWARE\\Mozilla\\Mozilla Firefox'
        },
        linux: {
            binaries: ['firefox'],
            paths: ['/usr/bin/firefox', '/usr/lib/firefox/firefox', '/snap/bin/firefox']
        }
    }
};

class BrowserDetector {
    constructor() {
        this.platform = os.platform();
        this.detectedBrowsers = [];
    }

    detect() {
        this.detectedBrowsers = [];

        for (const [key, browser] of Object.entries(BROWSERS)) {
            const result = this._checkBrowser(key, browser);
            if (result) {
                this.detectedBrowsers.push(result);
            }
        }

        console.log(`[BrowserDetector] Detected ${this.detectedBrowsers.length} browser(s):`,
            this.detectedBrowsers.map(b => b.name).join(', '));

        return this.detectedBrowsers;
    }

    _checkBrowser(key, browser) {
        if (this.platform === 'win32') {
            return this._checkWindows(key, browser);
        } else if (this.platform === 'linux') {
            return this._checkLinux(key, browser);
        }
        return null;
    }

    _checkWindows(key, browser) {
        const conf = browser.windows;
        if (!conf) return null;

        // Check file paths
        for (const p of conf.paths) {
            try {
                if (fs.existsSync(p)) {
                    return {
                        key,
                        name: browser.name,
                        type: browser.type,
                        executablePath: p,
                        platform: 'win32'
                    };
                }
            } catch {}
        }

        // Fallback: check registry
        if (conf.registryKey) {
            try {
                execSync(`reg query "${conf.registryKey}"`, { stdio: 'pipe' });
                return {
                    key,
                    name: browser.name,
                    type: browser.type,
                    executablePath: null,
                    platform: 'win32'
                };
            } catch {}
        }

        return null;
    }

    _checkLinux(key, browser) {
        const conf = browser.linux;
        if (!conf) return null;

        // Check known paths
        for (const p of conf.paths) {
            try {
                if (fs.existsSync(p)) {
                    return {
                        key,
                        name: browser.name,
                        type: browser.type,
                        executablePath: p,
                        platform: 'linux'
                    };
                }
            } catch {}
        }

        // Fallback: which command
        for (const bin of (conf.binaries || [])) {
            try {
                const result = execSync(`which ${bin}`, { stdio: 'pipe' }).toString().trim();
                if (result) {
                    return {
                        key,
                        name: browser.name,
                        type: browser.type,
                        executablePath: result,
                        platform: 'linux'
                    };
                }
            } catch {}
        }

        return null;
    }

    getChromiumBrowsers() {
        return this.detectedBrowsers.filter(b => b.type === 'chromium');
    }

    getFirefox() {
        return this.detectedBrowsers.find(b => b.type === 'firefox') || null;
    }

    hasAnyBrowser() {
        return this.detectedBrowsers.length > 0;
    }
}

module.exports = new BrowserDetector();
