const activeWin = require('active-win');

console.log('Testing active-win...');

(async () => {
    try {
        const result = await activeWin();
        if (result) {
            console.log('Success! Result:', result);
        } else {
            console.log('Success, but no active window returned (might be locked or no permission).');
        }
    } catch (error) {
        console.error('FAILED to get active window:', error);
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error('Fix: npm install active-win');
        }
    }
})();
