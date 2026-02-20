/**
 * NativeMessagingClient for Firefox -- uses browser.runtime.connectNative
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
        const data = await browser.storage.local.get('userId');
        this.userId = data.userId || null;
        this._connectNative();
    }

    _connectNative() {
        try {
            this.port = browser.runtime.connectNative(NATIVE_HOST_NAME);
            this.connected = true;
            this.useNative = true;
            this.reconnectAttempts = 0;

            this.port.onMessage.addListener((msg) => {
                this._handleMessage(msg);
            });

            this.port.onDisconnect.addListener(() => {
                this.connected = false;
                this.port = null;
                this._scheduleReconnect();
            });
        } catch (e) {
            console.warn('[NativeMsg] Native messaging unavailable, using HTTP fallback');
            this.useNative = false;
            this.connected = false;
        }
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
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
                browser.storage.local.set({ userId: msg.user_id });
            }
        }
    }

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
                console.error('[NativeMsg] Send failed, trying HTTP');
            }
        }

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
                    browser.storage.local.set({ userId: data.user_id });
                }
                return true;
            }
            return false;
        } catch (e) {
            console.warn('[NativeMsg] HTTP fallback failed');
            return false;
        }
    }

    async sendHeartbeat() {
        const msg = { type: 'HEARTBEAT', browser: 'firefox' };

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

var nativeClient = new NativeMessagingClient();
