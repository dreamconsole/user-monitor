# Feature Mapping: Electron vs Chrome Extension

This document clarifies how the Electron agent features were translated into the Chrome Extension.

| Feature | Electron Agent | Chrome Extension Equivalent | Status |
|---------|----------------|-----------------------------|--------|
| **Authentication** | `AuthService` with `electron-store` | `AuthService` with `chrome.storage.local` | Native |
| **Shift Management** | SQLite `work_sessions` | Persistent state in `chrome.storage.local` | Replicated |
| **Activity Tracking** | `uiohook-napi` (Global Keys/Mouse) | `chrome.tabs` + Content Activity (Limited to Browser) | Substituted |
| **Idle Detection** | `powerMonitor.getSystemIdleTime()` | `chrome.idle.onStateChanged` | Native |
| **Screenshots** | `screenshot-desktop` (Full Screen) | `chrome.tabs.captureVisibleTab` (Active Tab only) | Browser-Safe |
| **Device Identifier** | `node-machine-id` (Hardware ID) | Custom UUID stored in Extension Storage | Substituted |
| **Background Work** | Main Process (Node.js) | Manifest V3 Service Worker | Native |
| **Communication** | IPC (EventEmitter based) | `chrome.runtime.sendMessage` | Replicated |

## Key Differences & Limitations
1. **Global Tracking**: The extension CANNOT track activity in other applications (e.g., VS Code or Slack). It only tracks the active tab and overall idle state within the browser.
2. **Global Input**: `keyboard_events` and `mouse_events` are recorded as 0 since extensions cannot hook into global system events for privacy reasons.
3. **Screenshot Scope**: Screenshots are limited to the inner viewport of the active browser tab, while the Electron app could capture the entire desktop.
4. **Offline Storage**: While Electron has SQLite for long-term offline logging, the extension uses `chrome.storage.local` which has a smaller quota (5-10MB without `unlimitedStorage`).
