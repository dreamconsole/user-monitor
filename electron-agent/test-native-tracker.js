const nativeTracker = require('./src/services/nativeTracker');

console.log('Testing Native Tracker...');

(async () => {
    try {
        console.log('Getting active window...');
        const win = await nativeTracker.getActiveWindow();
        console.log('Result:', JSON.stringify(win, null, 2));

        if (win && win.title) {
            console.log('✅ Success!');
        } else {
            console.log('❌ Failed or no window active');
        }
    } catch (e) {
        console.error('Error:', e);
    }
})();
