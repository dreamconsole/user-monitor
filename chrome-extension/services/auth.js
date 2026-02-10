self.AuthService = {
    user: null,
    token: null,
    deviceId: null,

    async initialize(user, token) {
        this.user = user;
        this.token = token;

        // Get or create deviceId
        const result = await chrome.storage.local.get(['deviceId']);
        if (result.deviceId) {
            this.deviceId = result.deviceId;
        } else {
            this.deviceId = 'extension-' + self.crypto.randomUUID();
            await chrome.storage.local.set({ deviceId: this.deviceId });
        }

        if (user && token) {
            await chrome.storage.local.set({ user, token });
        }
        console.log('AuthService initialized with DeviceId:', this.deviceId);
    },

    async login(email, password) {
        const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, device_id: this.deviceId })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');

        await this.initialize(data.user, data.token);
        return data;
    },

    async logout() {
        this.user = null;
        this.token = null;
        await chrome.storage.local.remove(['user', 'token']);
        console.log('AuthService logout');
        if (self.MonitorService) MonitorService.stop();
        if (self.SyncService) SyncService.stop();
    },

    isAuthenticated() {
        return !!this.token;
    },

    getToken() {
        return this.token;
    },

    getUser() {
        return this.user;
    },

    getDeviceId() {
        return this.deviceId;
    }
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOGIN_SUCCESS') {
        AuthService.initialize(message.user, message.token);
        if (self.MonitorService) MonitorService.start();
        if (self.SyncService) SyncService.start();
    } else if (message.type === 'LOGOUT') {
        AuthService.logout();
    }
});
