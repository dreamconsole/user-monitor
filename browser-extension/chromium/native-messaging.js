/**
 * NativeMessagingClient -- handles communication with the desktop agent.
 * Primary: Chrome Native Messaging
 * Fallback: localhost HTTP
 */

const NATIVE_HOST_NAME = 'com.usermonitor.browser';
const FALLBACK_URL = 'http://127.0.0.1:45692';
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 12;

class NativeMessagingClient {
    constructor() {
        this.port = null;
        this.connected = false;
        this.useNative = true;
        this.reconnectAttempts = 0;
        this.userId = null;
    }

    async init() {
        const data = await chrome.storage.local.get(['userId']);
        this.userId = data.userId || null;
        this._connectNative();
    }

    _connectNative() {
        try {
            this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
            this.connected = true;
            this.useNative = true;
            this.reconnectAttempts = 0;
            console.log('[NativeMsg] Connected to native host');

            this.port.onMessage.addListener((msg) => {
                this._handleMessage(msg);
            });

            this.port.onDisconnect.addListener(() => {
                const err = chrome.runtime.lastError;
                console.warn('[NativeMsg] Disconnected:', err?.message || 'unknown');
                this.connected = false;
                this.port = null;
                this._scheduleReconnect();
            });
        } catch (e) {
            console.warn('[NativeMsg] Native messaging unavailable, using HTTP fallback:', e.message);
            this.useNative = false;
            this.connected = false;
        }
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[NativeMsg] Max reconnect attempts reached, switching to HTTP fallback');
            this.useNative = false;
            return;
        }
        this.reconnectAttempts++;
        setTimeout(() => this._connectNative(), RECONNECT_DELAY_MS);
    }

    _handleMessage(msg) {
        if (msg.type === 'CONFIG') {
            if (msg.user_id) {
                this.userId = msg.user_id;
                chrome.storage.local.set({ userId: msg.user_id });
            }
        }
    }

    /**
     * Send browser activity entries to the desktop agent.
     */
    async sendActivity(entries) {
        if (!entries || entries.length === 0) return;

        const payload = {
            type: 'BROWSER_ACTIVITY',
            user_id: this.userId,
            entries
        };

        if (this.useNative && this.connected && this.port) {
            try {
                this.port.postMessage(payload);
                return true;
            } catch (e) {
                console.error('[NativeMsg] Send failed, trying HTTP:', e.message);
            }
        }

        // HTTP fallback
        return this._sendHttp(payload);
    }

    async _sendHttp(payload) {
        try {
            const resp = await fetch(`${FALLBACK_URL}/browser-activity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.user_id && !this.userId) {
                    this.userId = data.user_id;
                    chrome.storage.local.set({ userId: data.user_id });
                }
                return true;
            }
            return false;
        } catch (e) {
            console.warn('[NativeMsg] HTTP fallback failed:', e.message);
            return false;
        }
    }

    /**
     * Send a heartbeat to let the agent know the extension is alive.
     */
    async sendHeartbeat() {
        const msg = { type: 'HEARTBEAT', browser: self.tabTracker?.browserName || 'unknown' };

        if (this.useNative && this.connected && this.port) {
            try { this.port.postMessage(msg); return; } catch {}
        }
        try {
            await fetch(`${FALLBACK_URL}/extension-heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msg)
            });
        } catch {}
    }
}

self.nativeClient = new NativeMessagingClient();
