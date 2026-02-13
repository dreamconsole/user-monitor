const { exec } = require('child_process');

const psCommand = `
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
    }
    $obj | ConvertTo-Json -Compress
} catch {
    # Process might have exited
}
`;

console.log('Testing PowerShell tracking...');

const fs = require('fs');

// ... (psCommand remains the same)

exec(`powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
    const output = {
        error: error ? error.message : null,
        stdout: stdout,
        stderr: stderr
    };
    fs.writeFileSync('test-output.txt', JSON.stringify(output, null, 2));
    console.log('Done');
});
