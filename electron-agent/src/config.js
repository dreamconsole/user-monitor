/**
 * API and app config. Load .env in main.js before any service that uses this.
 */
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
console.log('[AgentConfig] API_URL initialized to:', API_URL);

module.exports = {
    API_URL
};
