// Test script to verify active-win is working
const activeWin = require('active-win');

async function testAppTracking() {
    console.log('=== Testing App Tracker ===\n');

    try {
        console.log('1. Testing active-win package...');
        const activeWindow = await activeWin();

        if (!activeWindow) {
            console.error('❌ No active window detected!');
            console.log('This could mean:');
            console.log('  - active-win is not installed');
            console.log('  - No windows are open');
            console.log('  - Permission issues on Windows');
            return;
        }

        console.log('✅ Active window detected!\n');
        console.log('Window Details:');
        console.log('  Title:', activeWindow.title);
        console.log('  Owner:', activeWindow.owner.name);
        console.log('  Executable:', activeWindow.owner.path);
        console.log('  Process ID:', activeWindow.owner.processId);

        console.log('\n2. Testing continuous tracking (10 seconds)...');
        console.log('Switch between different apps to test detection.\n');

        let lastApp = activeWindow.owner.name;
        let switchCount = 0;

        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const current = await activeWin();
            if (current && current.owner.name !== lastApp) {
                switchCount++;
                console.log(`  [${i + 1}s] App switched: ${lastApp} → ${current.owner.name}`);
                lastApp = current.owner.name;
            } else if (current) {
                console.log(`  [${i + 1}s] Still using: ${current.owner.name}`);
            }
        }

        console.log(`\n✅ Test complete! Detected ${switchCount} app switches.`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\nTroubleshooting:');
        console.log('  1. Install active-win: npm install active-win@8.0.0');
        console.log('  2. Restart the terminal/command prompt');
        console.log('  3. Run as administrator if on Windows');
    }
}

testAppTracking();
