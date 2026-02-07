/**
 * API and app config. Load .env in main.js before any service that uses this.
 */
const API_URL = process.env.API_URL || 'http://localhost:3000';

module.exports = {
    API_URL
};
