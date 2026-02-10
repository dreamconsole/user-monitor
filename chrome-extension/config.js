const CONFIG = {
  API_URL: 'http://localhost:3000'
};

// Export for modules if using ES modules, otherwise global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
