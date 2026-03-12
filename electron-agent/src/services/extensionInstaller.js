/**
 * ExtensionInstaller -- Silently installs browser extensions and configures
 * native messaging hosts for all detected browsers.
 * 
 * Windows: Registry-based ExtensionInstallForcelist + NativeMessagingHosts keys
 * Linux: Policy JSON files under /etc/opt/ and /usr/lib/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EXTENSION_ID = 'EXTENSION_ID_PLACEHOLDER'; // Replace after publishing to Chrome Web Store or self-hosting
const NATIVE_HOST_NAME = 'com.usermonitor.browser';
const FIREFOX_EXTENSION_ID = 'usermonitor@activity-tracker';

// Where the agent installs itself
const INSTALL_PATHS = {
    win32: path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'UserMonitorAgent'),
    linux: '/opt/usermonitor-agent'
};

// Windows registry paths for Chromium ExtensionInstallForcelist
const CHROMIUM_REGISTRY = {
    chrome: 'HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist',
    edge: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist',
    brave: 'HKLM\\SOFTWARE\\Policies\\BraveSoftware\\Brave-Browser\\ExtensionInstallForcelist',
    opera: 'HKLM\\SOFTWARE\\Policies\\Opera\\ExtensionInstallForcelist'
};

// Windows registry paths for Native Messaging Hosts
const NATIVE_HOST_REGISTRY = {
    chrome: `HKLM\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`,
    edge: `HKLM\\SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`,
    brave: `HKLM\\SOFTWARE\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`,
    opera: `HKLM\\SOFTWARE\\Opera Software\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`
};

// Linux policy directories for Chromium browsers
const LINUX_POLICY_DIRS = {
    chrome: '/etc/opt/chrome/policies/managed',
    edge: '/etc/opt/edge/policies/managed',
    brave: '/etc/opt/brave/policies/managed',
    opera: '/etc/opt/opera/policies/managed'
};

// Linux native messaging host directories
const LINUX_NATIVE_DIRS = {
    chrome: '/etc/opt/chrome/native-messaging-hosts',
    edge: '/etc/opt/edge/native-messaging-hosts',
    brave: '/etc/opt/brave/native-messaging-hosts',
    opera: '/etc/opt/opera/native-messaging-hosts',
    firefox: '/usr/lib/mozilla/native-messaging-hosts'
};

// Firefox policy directories
const FIREFOX_POLICY = {
    win32: null, // Handled via registry or distribution folder
    linux: '/usr/lib/firefox/distribution'
};

class ExtensionInstaller {
    constructor() {
        this.platform = os.platform();
        this.installPath = INSTALL_PATHS[this.platform] || INSTALL_PATHS.linux;
        this.results = [];
    }

    /**
     * Install extensions and native messaging hosts for all detected browsers.
     * @param {Array} detectedBrowsers - from browserDetector.detect()
     */
    installAll(detectedBrowsers) {
        this.results = [];

        const { app } = require('electron');
        if (!app.isPackaged || process.env.NODE_ENV === 'development') {
            console.log('[ExtInstaller] Skipping extension installation in development mode.');
            return this.results;
        }

        for (const browser of detectedBrowsers) {
            try {
                if (browser.type === 'chromium') {
                    this._installChromiumExtension(browser);
                    this._installNativeHost(browser);
                } else if (browser.type === 'firefox') {
                    this._installFirefoxExtension(browser);
                    this._installNativeHost(browser);
                }
            } catch (e) {
                console.error(`[ExtInstaller] Failed for ${browser.name}:`, e.message);
                this.results.push({ browser: browser.name, success: false, error: e.message });
            }
        }

        return this.results;
    }

    // ===== CHROMIUM EXTENSION (Windows) =====

    _installChromiumExtension(browser) {
        if (this.platform === 'win32') {
            this._installChromiumWindows(browser);
        } else if (this.platform === 'linux') {
            this._installChromiumLinux(browser);
        }
    }

    _installChromiumWindows(browser) {
        const regPath = CHROMIUM_REGISTRY[browser.key];
        if (!regPath) {
            console.warn(`[ExtInstaller] No registry path for ${browser.key}`);
            return;
        }

        const extensionValue = `${EXTENSION_ID};https://clients2.google.com/service/update2/crx`;

        try {
            // Create the registry key if it doesn't exist
            execSync(`reg add "${regPath}" /v 1 /t REG_SZ /d "${extensionValue}" /f`, { stdio: 'pipe' });
            console.log(`[ExtInstaller] Registry ExtensionInstallForcelist set for ${browser.name}`);
            this.results.push({ browser: browser.name, type: 'extension', success: true });
        } catch (e) {
            // Try without admin (HKCU fallback)
            try {
                const hkcuPath = regPath.replace('HKLM\\', 'HKCU\\');
                execSync(`reg add "${hkcuPath}" /v 1 /t REG_SZ /d "${extensionValue}" /f`, { stdio: 'pipe' });
                console.log(`[ExtInstaller] HKCU fallback used for ${browser.name}`);
                this.results.push({ browser: browser.name, type: 'extension', success: true, note: 'HKCU' });
            } catch (e2) {
                throw new Error(`Registry write failed for ${browser.name}: ${e2.message}`);
            }
        }
    }

    _installChromiumLinux(browser) {
        const policyDir = LINUX_POLICY_DIRS[browser.key];
        if (!policyDir) return;

        const policy = {
            ExtensionInstallForcelist: [
                `${EXTENSION_ID};https://clients2.google.com/service/update2/crx`
            ]
        };

        try {
            fs.mkdirSync(policyDir, { recursive: true });
            fs.writeFileSync(
                path.join(policyDir, 'usermonitor_extension.json'),
                JSON.stringify(policy, null, 2)
            );
            console.log(`[ExtInstaller] Linux policy written for ${browser.name}`);
            this.results.push({ browser: browser.name, type: 'extension', success: true });
        } catch (e) {
            // Might need sudo -- try via shell
            try {
                const jsonStr = JSON.stringify(policy);
                execSync(`sudo mkdir -p "${policyDir}" && echo '${jsonStr}' | sudo tee "${policyDir}/usermonitor_extension.json" > /dev/null`, { stdio: 'pipe' });
                console.log(`[ExtInstaller] Linux policy written (sudo) for ${browser.name}`);
                this.results.push({ browser: browser.name, type: 'extension', success: true, note: 'sudo' });
            } catch (e2) {
                throw new Error(`Policy write failed for ${browser.name}: ${e2.message}`);
            }
        }
    }

    // ===== FIREFOX EXTENSION =====

    _installFirefoxExtension(browser) {
        if (this.platform === 'win32') {
            this._installFirefoxWindows(browser);
        } else if (this.platform === 'linux') {
            this._installFirefoxLinux(browser);
        }
    }

    _installFirefoxWindows(browser) {
        // Firefox uses policies.json in the installation directory
        const firefoxPaths = [
            path.join(process.env.PROGRAMFILES || '', 'Mozilla Firefox'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'Mozilla Firefox')
        ];

        for (const ffPath of firefoxPaths) {
            if (!fs.existsSync(ffPath)) continue;

            const distDir = path.join(ffPath, 'distribution');
            const policyFile = path.join(distDir, 'policies.json');

            const policy = {
                policies: {
                    ExtensionSettings: {
                        [FIREFOX_EXTENSION_ID]: {
                            installation_mode: 'force_installed',
                            install_url: `file:///${this.installPath.replace(/\\/g, '/')}/extensions/firefox/usermonitor.xpi`
                        }
                    }
                }
            };

            try {
                fs.mkdirSync(distDir, { recursive: true });

                // Merge with existing policies if present
                let existing = {};
                if (fs.existsSync(policyFile)) {
                    try { existing = JSON.parse(fs.readFileSync(policyFile, 'utf-8')); } catch { }
                }

                if (!existing.policies) existing.policies = {};
                if (!existing.policies.ExtensionSettings) existing.policies.ExtensionSettings = {};
                existing.policies.ExtensionSettings[FIREFOX_EXTENSION_ID] =
                    policy.policies.ExtensionSettings[FIREFOX_EXTENSION_ID];

                fs.writeFileSync(policyFile, JSON.stringify(existing, null, 2));
                console.log(`[ExtInstaller] Firefox policies.json written at ${policyFile}`);
                this.results.push({ browser: browser.name, type: 'extension', success: true });
                return;
            } catch (e) {
                console.warn(`[ExtInstaller] Firefox policy write failed at ${ffPath}:`, e.message);
            }
        }

        this.results.push({ browser: browser.name, type: 'extension', success: false, error: 'Firefox install dir not found' });
    }

    _installFirefoxLinux(browser) {
        const distDir = FIREFOX_POLICY.linux;
        if (!distDir) return;

        const policy = {
            policies: {
                ExtensionSettings: {
                    [FIREFOX_EXTENSION_ID]: {
                        installation_mode: 'force_installed',
                        install_url: `file://${this.installPath}/extensions/firefox/usermonitor.xpi`
                    }
                }
            }
        };

        try {
            fs.mkdirSync(distDir, { recursive: true });
            const policyFile = path.join(distDir, 'policies.json');

            let existing = {};
            if (fs.existsSync(policyFile)) {
                try { existing = JSON.parse(fs.readFileSync(policyFile, 'utf-8')); } catch { }
            }

            if (!existing.policies) existing.policies = {};
            if (!existing.policies.ExtensionSettings) existing.policies.ExtensionSettings = {};
            existing.policies.ExtensionSettings[FIREFOX_EXTENSION_ID] =
                policy.policies.ExtensionSettings[FIREFOX_EXTENSION_ID];

            fs.writeFileSync(policyFile, JSON.stringify(existing, null, 2));
            console.log(`[ExtInstaller] Firefox Linux policy written`);
            this.results.push({ browser: browser.name, type: 'extension', success: true });
        } catch (e) {
            try {
                const jsonStr = JSON.stringify(policy);
                execSync(`sudo mkdir -p "${distDir}" && echo '${jsonStr}' | sudo tee "${distDir}/policies.json" > /dev/null`, { stdio: 'pipe' });
                this.results.push({ browser: browser.name, type: 'extension', success: true, note: 'sudo' });
            } catch (e2) {
                throw new Error(`Firefox policy failed: ${e2.message}`);
            }
        }
    }

    // ===== NATIVE MESSAGING HOST =====

    _installNativeHost(browser) {
        if (this.platform === 'win32') {
            this._installNativeHostWindows(browser);
        } else if (this.platform === 'linux') {
            this._installNativeHostLinux(browser);
        }
    }

    _installNativeHostWindows(browser) {
        const nativeHostExePath = path.join(this.installPath, 'native-host', 'native-host.exe');

        if (browser.type === 'chromium') {
            const regPath = NATIVE_HOST_REGISTRY[browser.key];
            if (!regPath) return;

            // Write manifest file
            const manifestDir = path.join(this.installPath, 'native-host');
            fs.mkdirSync(manifestDir, { recursive: true });

            const manifest = {
                name: NATIVE_HOST_NAME,
                description: 'User Monitor Browser Activity Native Messaging Host',
                path: nativeHostExePath,
                type: 'stdio',
                allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
            };

            const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

            // Point registry to manifest
            try {
                execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'pipe' });
                console.log(`[ExtInstaller] NativeMessagingHost registry set for ${browser.name}`);
                this.results.push({ browser: browser.name, type: 'native-host', success: true });
            } catch (e) {
                const hkcuPath = regPath.replace('HKLM\\', 'HKCU\\');
                try {
                    execSync(`reg add "${hkcuPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'pipe' });
                    this.results.push({ browser: browser.name, type: 'native-host', success: true, note: 'HKCU' });
                } catch (e2) {
                    this.results.push({ browser: browser.name, type: 'native-host', success: false, error: e2.message });
                }
            }
        } else if (browser.type === 'firefox') {
            // Firefox uses registry differently
            const regPath = `HKLM\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
            const manifestDir = path.join(this.installPath, 'native-host');
            fs.mkdirSync(manifestDir, { recursive: true });

            const manifest = {
                name: NATIVE_HOST_NAME,
                description: 'User Monitor Browser Activity Native Messaging Host',
                path: nativeHostExePath,
                type: 'stdio',
                allowed_extensions: [FIREFOX_EXTENSION_ID]
            };

            const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.firefox.json`);
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

            try {
                execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'pipe' });
                this.results.push({ browser: browser.name, type: 'native-host', success: true });
            } catch (e) {
                this.results.push({ browser: browser.name, type: 'native-host', success: false, error: e.message });
            }
        }
    }

    _installNativeHostLinux(browser) {
        const nativeHostPath = path.join(this.installPath, 'native-host', 'native-host');

        if (browser.type === 'chromium') {
            const nativeDir = LINUX_NATIVE_DIRS[browser.key];
            if (!nativeDir) return;

            const manifest = {
                name: NATIVE_HOST_NAME,
                description: 'User Monitor Browser Activity Native Messaging Host',
                path: nativeHostPath,
                type: 'stdio',
                allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
            };

            const manifestPath = path.join(nativeDir, `${NATIVE_HOST_NAME}.json`);

            try {
                fs.mkdirSync(nativeDir, { recursive: true });
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                this.results.push({ browser: browser.name, type: 'native-host', success: true });
            } catch (e) {
                try {
                    const jsonStr = JSON.stringify(manifest);
                    execSync(`sudo mkdir -p "${nativeDir}" && echo '${jsonStr}' | sudo tee "${manifestPath}" > /dev/null`, { stdio: 'pipe' });
                    this.results.push({ browser: browser.name, type: 'native-host', success: true, note: 'sudo' });
                } catch (e2) {
                    this.results.push({ browser: browser.name, type: 'native-host', success: false, error: e2.message });
                }
            }
        } else if (browser.type === 'firefox') {
            const nativeDir = LINUX_NATIVE_DIRS.firefox;

            const manifest = {
                name: NATIVE_HOST_NAME,
                description: 'User Monitor Browser Activity Native Messaging Host',
                path: nativeHostPath,
                type: 'stdio',
                allowed_extensions: [FIREFOX_EXTENSION_ID]
            };

            const manifestPath = path.join(nativeDir, `${NATIVE_HOST_NAME}.json`);

            try {
                fs.mkdirSync(nativeDir, { recursive: true });
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                this.results.push({ browser: browser.name, type: 'native-host', success: true });
            } catch (e) {
                try {
                    const jsonStr = JSON.stringify(manifest);
                    execSync(`sudo mkdir -p "${nativeDir}" && echo '${jsonStr}' | sudo tee "${manifestPath}" > /dev/null`, { stdio: 'pipe' });
                    this.results.push({ browser: browser.name, type: 'native-host', success: true, note: 'sudo' });
                } catch (e2) {
                    this.results.push({ browser: browser.name, type: 'native-host', success: false, error: e2.message });
                }
            }
        }
    }

    /**
     * Uninstall all browser extension policies and native messaging host configs.
     */
    uninstallAll(detectedBrowsers) {
        for (const browser of detectedBrowsers) {
            try {
                if (this.platform === 'win32') {
                    this._uninstallWindows(browser);
                } else if (this.platform === 'linux') {
                    this._uninstallLinux(browser);
                }
            } catch (e) {
                console.error(`[ExtInstaller] Uninstall failed for ${browser.name}:`, e.message);
            }
        }
    }

    _uninstallWindows(browser) {
        if (browser.type === 'chromium') {
            const regPath = CHROMIUM_REGISTRY[browser.key];
            if (regPath) {
                try { execSync(`reg delete "${regPath}" /f`, { stdio: 'pipe' }); } catch { }
            }
            const nativeRegPath = NATIVE_HOST_REGISTRY[browser.key];
            if (nativeRegPath) {
                try { execSync(`reg delete "${nativeRegPath}" /f`, { stdio: 'pipe' }); } catch { }
            }
        } else if (browser.type === 'firefox') {
            try { execSync(`reg delete "HKLM\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\${NATIVE_HOST_NAME}" /f`, { stdio: 'pipe' }); } catch { }
        }
    }

    _uninstallLinux(browser) {
        if (browser.type === 'chromium') {
            const policyDir = LINUX_POLICY_DIRS[browser.key];
            if (policyDir) {
                const policyFile = path.join(policyDir, 'usermonitor_extension.json');
                try { fs.unlinkSync(policyFile); } catch { }
            }
            const nativeDir = LINUX_NATIVE_DIRS[browser.key];
            if (nativeDir) {
                const manifestFile = path.join(nativeDir, `${NATIVE_HOST_NAME}.json`);
                try { fs.unlinkSync(manifestFile); } catch { }
            }
        } else if (browser.type === 'firefox') {
            const nativeDir = LINUX_NATIVE_DIRS.firefox;
            if (nativeDir) {
                try { fs.unlinkSync(path.join(nativeDir, `${NATIVE_HOST_NAME}.json`)); } catch { }
            }
        }
    }
}

module.exports = new ExtensionInstaller();
