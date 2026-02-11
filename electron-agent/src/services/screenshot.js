const screenshot = require('screenshot-desktop');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const configService = require('./config');

class ScreenshotService {
    constructor() {
        this.interval = null;
        this.currentState = 'OFFLINE';
        this.lastCaptureTime = 0;
        this.orgId = null;
        this.userId = null;
        this.deviceId = null;

        // Dynamic Config
        this.captureIntervalMs = (configService.get('screenshot_interval_seconds') || 600) * 1000;
        this.isEnabled = configService.get('is_screenshots_enabled') !== false;

        // Listen for config changes
        configService.on('config-updated', (config) => {
            console.log('[ScreenshotService] Config updated, applying new settings...');
            const newInterval = (config.screenshot_interval_seconds || 600) * 1000;
            const newEnabled = config.is_screenshots_enabled !== false;

            this.isEnabled = newEnabled;

            // If interval changed, restart
            if (newInterval !== this.captureIntervalMs && this.interval) {
                this.captureIntervalMs = newInterval;
                if (this.currentState === 'ACTIVE') {
                    this.stop();
                    this.start(this.orgId, this.userId, this.deviceId, this.sessionId);
                }
            } else {
                this.captureIntervalMs = newInterval;
            }
        });
    }

    start(orgId, userId, deviceId, sessionId) {
        console.log('Starting Screenshot Service...');
        this.orgId = orgId;
        this.userId = userId;
        this.deviceId = deviceId;
        this.sessionId = sessionId;
        this.currentState = 'ACTIVE'; // synced with monitor usually, defaulting to active
        this.lastCaptureTime = Date.now(); // Reset timer on start so we don't capture immediately unless check logic allows

        // Refresh config on start
        this.captureIntervalMs = (configService.get('screenshot_interval_seconds') || 600) * 1000;
        this.isEnabled = configService.get('is_screenshots_enabled') !== false;

        if (this.interval) clearInterval(this.interval);

        // Check every minute if we need to capture (timer tick)
        // If the interval is very small (testing), we might want a tighter loop, but 1min is standard for now
        this.interval = setInterval(() => {
            this.checkAndCapture();
        }, 30 * 1000); // Check more frequently (30s) to catch smaller intervals
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        console.log('Screenshot Service stopped.');
    }

    setCurrentState(state) {
        this.currentState = state;
    }

    async checkAndCapture() {
        if (this.currentState !== 'ACTIVE' || !this.isEnabled) {
            // console.log('Skipping screenshot: User not ACTIVE or Screenhots disabled');
            return;
        }

        const now = Date.now();
        if (now - this.lastCaptureTime >= this.captureIntervalMs) {
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
