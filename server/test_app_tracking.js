import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test credentials (update with your actual test user)
const TEST_USER = {
    email: 'admin@test.com',
    password: 'password123'
};

let authToken = null;

async function login() {
    console.log('\n🔐 Logging in...');
    try {
        const response = await axios.post(`${API_URL}/auth/login`, TEST_USER);
        authToken = response.data.token;
        console.log('✓ Login successful');
        return response.data;
    } catch (error) {
        console.error('✗ Login failed:', error.response?.data || error.message);
        throw error;
    }
}

async function testGetCategories() {
    console.log('\n📂 Testing GET /app-tracking/categories');
    try {
        const response = await axios.get(`${API_URL}/app-tracking/categories`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✓ Categories retrieved:', response.data.length);
        response.data.forEach(cat => {
            console.log(`  - ${cat.name} (${cat.productivity_type})`);
        });
        return response.data;
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }
}

async function testCreateCategory() {
    console.log('\n➕ Testing POST /app-tracking/categories');
    try {
        const response = await axios.post(`${API_URL}/app-tracking/categories`, {
            name: 'Test Category',
            productivity_type: 'productive',
            description: 'Test category for automation'
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✓ Category created:', response.data.name);
        return response.data;
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }
}

async function testGetTrackedApps() {
    console.log('\n📱 Testing GET /app-tracking/apps');
    try {
        const response = await axios.get(`${API_URL}/app-tracking/apps`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✓ Tracked apps retrieved:', response.data.length);
        response.data.slice(0, 5).forEach(app => {
            console.log(`  - ${app.executable_name} → ${app.category_name || 'Uncategorized'}`);
        });
        return response.data;
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }
}

async function testGetUnmappedApps() {
    console.log('\n🔍 Testing GET /app-tracking/apps?unmapped=true');
    try {
        const response = await axios.get(`${API_URL}/app-tracking/apps?unmapped=true`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✓ Unmapped apps retrieved:', response.data.length);
        response.data.slice(0, 5).forEach(app => {
            console.log(`  - ${app.executable_name}`);
        });
        return response.data;
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }
}

async function testLogAppUsage(userId) {
    console.log('\n📝 Testing POST /app-tracking/usage/log');
    try {
        const response = await axios.post(`${API_URL}/app-tracking/usage/log`, {
            logs: [
                {
                    executable_name: 'Code.exe',
                    window_title: 'Visual Studio Code - test.js',
                    start_time: new Date(Date.now() - 300000).toISOString(),
                    end_time: new Date().toISOString(),
                    duration_seconds: 300
                },
                {
                    executable_name: 'chrome.exe',
                    window_title: 'Google Chrome - Stack Overflow',
                    start_time: new Date(Date.now() - 600000).toISOString(),
                    end_time: new Date(Date.now() - 300000).toISOString(),
                    duration_seconds: 300
                }
            ]
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✓ App usage logged:', response.data.message);
        return response.data;
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }
}

async function testGetUserDashboard(userId) {
    console.log('\n📊 Testing GET /app-tracking/reports/user/:userId');
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await axios.get(
            `${API_URL}/app-tracking/reports/user/${userId}?start_date=${today}&end_date=${today}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✓ User dashboard retrieved');
        console.log('  Summary entries:', response.data.summary?.length || 0);
        console.log('  Top apps:', response.data.top_apps?.length || 0);
        return response.data;
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }
}

async function testAggregation() {
    console.log('\n⚙️ Testing aggregation job');
    try {
        const { aggregateAppUsage } = await import('./src/jobs/aggregateAppUsage.js');
        const today = new Date().toISOString().split('T')[0];
        const result = await aggregateAppUsage(today);
        console.log('✓ Aggregation completed:', result);
        return result;
    } catch (error) {
        console.error('✗ Failed:', error.message);
    }
}

async function runTests() {
    console.log('🧪 Starting Backend API Tests\n');
    console.log('API URL:', API_URL);

    try {
        // Login
        const loginData = await login();
        const userId = loginData.user.id;

        // Test categories
        await testGetCategories();
        await testCreateCategory();

        // Test tracked apps
        await testGetTrackedApps();
        await testGetUnmappedApps();

        // Test usage logging
        await testLogAppUsage(userId);

        // Test dashboard
        await testGetUserDashboard(userId);

        // Test aggregation
        await testAggregation();

        console.log('\n✅ All tests completed!');
    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

runTests();
