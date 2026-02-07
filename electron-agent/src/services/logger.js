const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
    constructor() {
        this.logPath = null;
    }

    init(orgId, userId) {
        let userDataPath;
        try {
            userDataPath = app.getPath('userData');
        } catch (e) {
            // Probably in renderer
            const { ipcRenderer } = require('electron');
            userDataPath = ipcRenderer.sendSync('get-user-data-path');
        }
        this.logPath = path.join(userDataPath, 'sync_errors.log');

        console.log(`Logger initialized. Errors will be logged to: ${this.logPath}`);

        this.log('--- SESSION STARTED ---');
    }

    log(message) {
        if (!this.logPath) {
            console.log('[PRE-INIT LOG]:', message);
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;

        try {
            fs.appendFileSync(this.logPath, logEntry);
        } catch (e) {
            console.error('Failed to write to log file:', e);
        }
    }

    error(message, err) {
        const detail = err ? ` | Error: ${err.message}${err.response ? ' | Resp: ' + JSON.stringify(err.response.data) : ''}` : '';
        this.log(`ERROR: ${message}${detail}`);
    }
}

module.exports = new Logger();
