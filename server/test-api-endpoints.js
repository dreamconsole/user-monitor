import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testEndpoints() {
    console.log('=== Testing App Tracking API Endpoints ===\n');
    console.log(`API URL: ${API_URL}\n`);

    // You'll need to replace these with actual values from your database
    const token = 'YOUR_JWT_TOKEN_HERE'; // Get from localStorage after login
    const userId = 'YOUR_USER_ID_HERE'; // Get from database

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const today = new Date().toISOString().split('T')[0];

    try {
        console.log('1. Testing GET /app-tracking/reports/user/:userId');
        const dashboardUrl = `${API_URL}/app-tracking/reports/user/${userId}?start_date=${today}&end_date=${today}`;
        console.log(`   URL: ${dashboardUrl}`);

        const dashboardRes = await axios.get(dashboardUrl, { headers });
        console.log('   ✅ Status:', dashboardRes.status);
        console.log('   Response:', JSON.stringify(dashboardRes.data, null, 2));

    } catch (error) {
        console.error('   ❌ Error:', error.response?.status, error.response?.data || error.message);
    }

    try {
        console.log('\n2. Testing GET /app-tracking/reports/productivity/:userId');
        const productivityUrl = `${API_URL}/app-tracking/reports/productivity/${userId}?start_date=${today}&end_date=${today}`;
        console.log(`   URL: ${productivityUrl}`);

        const productivityRes = await axios.get(productivityUrl, { headers });
        console.log('   ✅ Status:', productivityRes.status);
        console.log('   Response:', JSON.stringify(productivityRes.data, null, 2));

    } catch (error) {
        console.error('   ❌ Error:', error.response?.status, error.response?.data || error.message);
    }

    try {
        console.log('\n3. Testing GET /app-tracking/categories');
        const categoriesRes = await axios.get(`${API_URL}/app-tracking/categories`, { headers });
        console.log('   ✅ Status:', categoriesRes.status);
        console.log('   Categories:', categoriesRes.data.length);

    } catch (error) {
        console.error('   ❌ Error:', error.response?.status, error.response?.data || error.message);
    }

    console.log('\n=== Instructions ===');
    console.log('1. Login to the web dashboard');
    console.log('2. Open browser console (F12)');
    console.log('3. Run: localStorage.getItem("token")');
    console.log('4. Run: JSON.parse(localStorage.getItem("user")).id');
    console.log('5. Replace token and userId in this script');
    console.log('6. Run: node test-api-endpoints.js');
}

testEndpoints();
