const screenshot = require('screenshot-desktop');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const CAPTURE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
// const CAPTURE_INTERVAL_MS = 10 * 1000; // 10 seconds for testing

class ScreenshotService {
    constructor() {
        this.interval = null;
        this.currentState = 'OFFLINE';
        this.lastCaptureTime = 0;
        this.orgId = null;
        this.userId = null;
        this.deviceId = null;
    }

    start(orgId, userId, deviceId, sessionId) {
        console.log('Starting Screenshot Service...');
        this.orgId = orgId;
        this.userId = userId;
        this.deviceId = deviceId;
        this.sessionId = sessionId;
        this.currentState = 'ACTIVE'; // synced with monitor usually, defaulting to active
        this.lastCaptureTime = Date.now(); // Reset timer on start so we don't capture immediately unless check logic allows

        if (this.interval) clearInterval(this.interval);

        // Check every minute if we need to capture to avoid drifting too far
        this.interval = setInterval(() => {
            this.checkAndCapture();
        }, 60 * 1000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        console.log('Screenshot Service stopped.');
    }

    setCurrentState(state) {
        this.currentState = state;
    }

    async checkAndCapture() {
        if (this.currentState !== 'ACTIVE') {
            // console.log('Skipping screenshot: User not ACTIVE');
            return;
        }

        const now = Date.now();
        if (now - this.lastCaptureTime >= CAPTURE_INTERVAL_MS) {
            await this.capture();
        }
    }

    async capture() {
        try {
            console.log('Capturing screenshot...');
            const imgBuffer = await screenshot({ format: 'jpg' }); // Returns buffer

            // Save to disk
            const fileName = `${uuidv4()}.jpg`;
            const dataPath = db.getAgentDataPath(this.orgId, this.userId);
            const screenshotsDir = path.join(dataPath, 'screenshots');

            if (!fs.existsSync(screenshotsDir)) {
                fs.mkdirSync(screenshotsDir, { recursive: true });
            }

            const filePath = path.join(screenshotsDir, fileName);
            fs.writeFileSync(filePath, imgBuffer);

            // Record in DB
            this.recordCapture(filePath);

            this.lastCaptureTime = Date.now();
            console.log(`Screenshot saved: ${filePath}`);

        } catch (error) {
            console.error('Failed to capture screenshot', error);
        }
    }

    recordCapture(filePath) {
        const id = uuidv4();
        const stmt = db.getDB().prepare(`
            INSERT INTO screenshots (id, org_id, user_id, session_id, device_id, file_path, captured_at, activity_type, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'pending')
        `);

        stmt.run(
            id,
            this.orgId,
            this.userId,
            this.sessionId,
            this.deviceId,
            filePath,
            Date.now()
        );
    }
}

module.exports = new ScreenshotService();
