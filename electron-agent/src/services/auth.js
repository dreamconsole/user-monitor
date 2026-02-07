const axios = require('axios');
const db = require('../db');
const logger = require('./logger');
const { machineIdSync } = require('node-machine-id');
const Store = require('electron-store');
const { API_URL } = require('../config');
const store = new Store();

class AuthService {
    constructor() {
        this.token = store.get('token');
        this.user = store.get('user');
        try {
            this.deviceId = machineIdSync();
        } catch (e) {
            console.error('Failed to get machine ID:', e);
            this.deviceId = 'unknown-device-' + Date.now();
        }
    }

    async checkAutoLogin() {
        if (!this.token || !this.user) return null;

        const tokenExpiry = store.get('tokenExpiry');
        if (!tokenExpiry || Date.now() > tokenExpiry) {
            this.logout();
            return null;
        }

        return { user: this.user, token: this.token };
    }

    async login(email, password) {
        try {
            console.log(`Attempting login to: ${API_URL}/auth/login`);
            const response = await axios.post(`${API_URL}/auth/login`, {
                email,
                password,
                device_id: this.deviceId
            });

            console.log('Login Response:', response.data);

            const { token, user } = response.data;
            this.token = token;
            this.user = user;

            // Init Logger
            logger.init(this.user.org_id, this.user.id);

            // Init DB
            // Store token for 30 days
            const expiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
            store.set('token', token);
            store.set('user', user);
            store.set('tokenExpiry', expiry);

            return { user, token };
        } catch (error) {
            console.error('Login failed:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        store.delete('token');
        store.delete('user');
        store.delete('tokenExpiry');
    }

    setUser(user) {
        this.user = user;
    }

    setToken(token) {
        this.token = token;
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    getDeviceId() {
        return this.deviceId;
    }
}

module.exports = new AuthService();
