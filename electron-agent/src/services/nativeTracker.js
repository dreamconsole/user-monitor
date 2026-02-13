const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let activeWinPkg = null;
try {
    activeWinPkg = require('active-win');
} catch (e) {
    console.warn('[NativeTracker] active-win package not found. Will use PowerShell fallback.');
}

class NativeTracker {
    constructor() {
        this.psScriptPath = path.join(__dirname, 'get-active-window.ps1');
    }

    async getActiveWindow() {
        // Method 1: Try active-win package (fastest/best if available)
        if (activeWinPkg) {
            try {
                return await activeWinPkg();
            } catch (error) {
                console.warn('[NativeTracker] active-win failed, trying fallback:', error.message);
            }
        }

        // Method 2: PowerShell Fallback (Windows only)
        if (process.platform === 'win32') {
            return this.getActiveWindowPowerShell();
        }

        return null;
    }

    getActiveWindowPowerShell() {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.psScriptPath)) {
                // Try to write the script if it doesn't exist (self-healing)
                this.writePowerShellScript();
            }

            const command = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${this.psScriptPath}"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('[NativeTracker] PowerShell error:', error.message);
                    resolve(null); // specific resolve null to avoid crashing polling loop
                    return;
                }

                if (!stdout || stdout.trim() === '') {
                    resolve(null);
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    // Map PowerShell result to active-win format
                    // PS returns: { owner: { name, processId, path }, title }
                    // active-win returns: { owner: { name, processId, path }, title, ... }
                    // They match closely!
                    resolve(result);
                } catch (parseError) {
                    console.error('[NativeTracker] JSON Parse error:', parseError.message, stdout);
                    resolve(null);
                }
            });
        });
    }

    writePowerShellScript() {
        const psContent = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class Utils {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
}
'@

Add-Type $code

$hwnd = [Utils]::GetForegroundWindow()
if ($hwnd -eq 0) { exit }

$pid = 0
[Utils]::GetWindowThreadProcessId($hwnd, [ref] $pid)

try {
    $process = Get-Process -Id $pid -ErrorAction Stop
    $obj = [PSCustomObject]@{
        owner = @{
            name = $process.Name
            processId = $process.Id
            path = $process.Path
        }
        title = $process.MainWindowTitle
        platform = "win32"
    }
    $obj | ConvertTo-Json -Compress
} catch {
    # Process might have exited
}
`;
        try {
            fs.writeFileSync(this.psScriptPath, psContent);
        } catch (e) {
            console.error('[NativeTracker] Failed to create PS script:', e);
        }
    }
}

module.exports = new NativeTracker();
