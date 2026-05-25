const EventEmitter = require('events');
const Store = require('electron-store');
const store = new Store();

class ConfigService extends EventEmitter {
    constructor() {
        super();
        this.config = {
            is_activity_tracking_enabled: true,
            is_screenshots_enabled: true,
            screenshot_interval_seconds: 600, // 10 minutes default
            is_afk_tracking_enabled: true,
            afk_threshold_seconds: 300, // 5 minutes default
            is_breaks_enabled: true,
            shift_grace_minutes: 5,
            shift_absence_minutes: 120,
            shift_absence_action: 'logout',
            heartbeat_interval_seconds: 300,
        };
        this.loadFromStore();
    }

    loadFromStore() {
        const savedConfig = store.get('agent_features');
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }
    }

    update(newFeatures) {
        if (!newFeatures) return;

        let hasChanged = false;

        // Compare and update keys
        for (const [key, value] of Object.entries(newFeatures)) {
            if (value !== undefined && value !== null && this.config[key] !== value) {
                this.config[key] = value;
                hasChanged = true;
            }
        }

        if (hasChanged) {
            store.set('agent_features', this.config);
            console.log('Agent Config Updated:', this.config);
            this.emit('config-updated', this.config);
        }
    }

    get(key) {
        return this.config[key];
    }

    getAll() {
        return this.config;
    }
}

module.exports = new ConfigService();
