# MSI builds on Linux vs Windows

## What fails on Ubuntu (Wine)

Building **`msi`** with `electron-builder` runs the WiX Toolset (`light.exe`) under Wine. The linker creates CAB files using Windows COM interop (`WixToolset.Cab`). Wine frequently hits:

```text
light.exe : error LGHT0001 : System.Runtime.InteropServices.COMException
... NativeMethods.CreateCabFinish ...
```

Workarounds such as WiX `-ct 1` or `-dcl:none` **do not reliably fix** WiX 4 + Wine for this project. This is a known class of limitations for **WiX 4 CAB creation under Wine**, not a bug in your app code.

## What works on Linux

- **`npm run dist:win:nsis`** (or `npx electron-builder --win nsis:x64`) — produces the **NSIS Setup `.exe`**, `latest.yml`, and blockmap. This path is what **electron-updater** uses on Windows.

## Where to build the MSI

Use one of:

1. **GitHub Actions** — Workflow `.github/workflows/electron-agent-release.yml` runs on **`windows-latest`** and runs `electron-builder --win --publish always`, which builds **both NSIS and MSI** without Wine.
2. **A Windows machine** — `cd electron-agent` → `npx electron-builder --win msi:x64` (or full `npm run dist:win`).

## Artifacts (this repo’s `package.json`)

- **Auto-update / most users:** `User Monitor Agent Setup x.y.z.exe` (NSIS).
- **IT / GPO style installs:** `User Monitor Agent x.y.z.msi` — build on **Windows** or **CI**, not on Ubuntu+Wine for production-quality output.
