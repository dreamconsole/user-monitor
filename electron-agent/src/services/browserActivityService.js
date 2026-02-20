/**
 * BrowserActivityService -- Local HTTP server on port 45692 that receives
 * browser activity data from extensions (via native messaging host or HTTP fallback).
 * Stores data in local SQLite and queues for backend sync.
 */

const http = require('http');
const db = require('../db');
const authService = require('./auth');
const logger = require('./logger');

const PORT = 45692;
const HOST = '127.0.0.1';

class BrowserActivityService {
    constructor() {
        this.server = null;
        this.isRunning = false;
        // Track which browsers have active extensions (updated on heartbeat/activity)
        this.activeBrowserExtensions = new Set();
        this._extensionTimeouts = {};
    }

    /**
     * Check if a browser has an active extension sending data.
     * Used by appTracker to decide whether to use window title fallback.
     */
    hasActiveExtension(browserKey) {
        return this.activeBrowserExtensions.has(browserKey);
    }

    _markExtensionActive(browserName) {
        const key = (browserName || '').toLowerCase().trim();
        if (!key) return;
        this.activeBrowserExtensions.add(key);

        // Auto-expire after 5 minutes if no new data arrives
        if (this._extensionTimeouts[key]) clearTimeout(this._extensionTimeouts[key]);
        this._extensionTimeouts[key] = setTimeout(() => {
            this.activeBrowserExtensions.delete(key);
            delete this._extensionTimeouts[key];
        }, 5 * 60 * 1000);
    }

    start() {
        if (this.isRunning) return;

        this.server = http.createServer((req, res) => {
            // CORS for extension HTTP fallback
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            if (req.method !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
            }

            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    this._handleMessage(req.url, data, res);
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        });

        this.server.listen(PORT, HOST, () => {
            console.log(`[BrowserActivity] Local HTTP server listening on ${HOST}:${PORT}`);
            this.isRunning = true;
        });

        this.server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.warn(`[BrowserActivity] Port ${PORT} in use, retrying in 5s...`);
                setTimeout(() => this.start(), 5000);
            } else {
                console.error('[BrowserActivity] Server error:', e.message);
            }
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.isRunning = false;
        }
        Object.values(this._extensionTimeouts).forEach(t => clearTimeout(t));
        this._extensionTimeouts = {};
        this.activeBrowserExtensions.clear();
        console.log('[BrowserActivity] Local HTTP server stopped');
    }

    _handleMessage(url, data, res) {
        const user = authService.getUser();
        const userId = user ? user.id : data.user_id;
        const orgId = user ? user.org_id : null;

        switch (url) {
            case '/browser-activity':
            case '/native-message':
                this._handleBrowserActivity(data, userId, orgId, res);
                break;

            case '/extension-heartbeat':
                this._handleHeartbeat(data, res);
                break;

            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
        }
    }

    _handleBrowserActivity(data, userId, orgId, res) {
        try {
            if (!db.isInitialized()) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Agent not ready' }));
                return;
            }

            const entries = data.entries || [];
            let saved = 0;

            for (const entry of entries) {
                try {
                    const browserName = entry.browser || data.browser || 'unknown';
                    this._markExtensionActive(browserName);

                    db.insertBrowserActivityLog({
                        user_id: userId,
                        org_id: orgId,
                        browser: browserName,
                        domain: entry.domain,
                        title: entry.title || '',
                        start_time: entry.start_time,
                        end_time: entry.end_time,
                        duration_seconds: entry.duration || 0,
                        source: 'extension'
                    });
                    saved++;
                } catch (e) {
                    logger.error('Failed to save browser activity entry', e);
                }
            }

            console.log(`[BrowserActivity] Stored ${saved}/${entries.length} entries`);

            const response = { status: 'ok', saved };
            if (userId) response.user_id = userId;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } catch (e) {
            logger.error('Browser activity handler error', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal error' }));
        }
    }

    _handleHeartbeat(data, res) {
        const browserName = data.browser || 'unknown';
        console.log(`[BrowserActivity] Extension heartbeat from ${browserName}`);
        this._markExtensionActive(browserName);

        const user = authService.getUser();
        const response = { status: 'ok' };
        if (user) response.user_id = user.id;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    }
}

module.exports = new BrowserActivityService();
