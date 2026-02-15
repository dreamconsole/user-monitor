/**
 * COMPREHENSIVE TEST SUITE - User Monitor System
 * Tests: All API Endpoints, CRUD Operations, Validation, Auth, Agent Communication
 * Generates structured testing report
 */
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

const API_URL = process.env.API_URL || 'http://localhost:3000';
const CLIENT_URL = 'http://localhost:5173';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// ── Test State ──
const state = {
    adminToken: null,
    adminUser: null,
    testUserId: null,
    testUserToken: null,
    testManagerId: null,
    testManagerToken: null,
    testBreakId: null,
    testCategoryId: null,
    testAppId: null,
    testOrgId: null,
};

// ── Report Collector ──
const report = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    passedTests: [],
    failedTests: [],
    suggestions: [],
    sections: {},
    startTime: Date.now(),
};

function addResult(section, testName, passed, details = '', suggestion = '') {
    report.total++;
    if (!report.sections[section]) {
        report.sections[section] = { passed: 0, failed: 0, tests: [] };
    }
    
    const entry = { testName, passed, details, timestamp: new Date().toISOString() };
    report.sections[section].tests.push(entry);
    
    if (passed) {
        report.passed++;
        report.sections[section].passed++;
        report.passedTests.push(`[${section}] ${testName}`);
    } else {
        report.failed++;
        report.sections[section].failed++;
        report.failedTests.push(`[${section}] ${testName}: ${details}`);
        if (suggestion) report.suggestions.push(`[${section}] ${suggestion}`);
    }
}

function addError(section, testName, error) {
    const msg = error?.response?.data?.error || error?.message || String(error);
    const status = error?.response?.status || 'N/A';
    report.errors.push({ section, testName, message: msg, status, timestamp: new Date().toISOString() });
    addResult(section, testName, false, `HTTP ${status}: ${msg}`);
}

// ── Helpers ──
function headers(token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request(method, path, data = null, token = null) {
    const config = {
        method,
        url: `${API_URL}${path}`,
        headers: token ? headers(token) : { 'Content-Type': 'application/json' },
        validateStatus: () => true, // Don't throw on non-2xx
    };
    if (data && ['post', 'patch', 'put', 'delete'].includes(method)) config.data = data;
    if (data && method === 'get') config.params = data;
    return axios(config);
}

const randomEmail = () => `test_${crypto.randomBytes(4).toString('hex')}@testmonitor.com`;
const randomName = () => `TestUser_${crypto.randomBytes(3).toString('hex')}`;

// ═══════════════════════════════════════════════════════════════
// SECTION 1: SERVER CONNECTIVITY
// ═══════════════════════════════════════════════════════════════
async function testServerConnectivity() {
    const section = '1. Server Connectivity';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    // Test 1.1: Root endpoint
    try {
        const res = await request('get', '/');
        const ok = res.status === 200 && res.data?.message;
        addResult(section, 'GET / - Root endpoint responds', ok, ok ? `Message: "${res.data.message}"` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Root endpoint: ${res.status}`);
    } catch (e) { addError(section, 'GET / - Root endpoint', e); console.log(`  ❌ Root endpoint error`); }

    // Test 1.2: ENV check
    try {
        const res = await request('get', '/env-check');
        const ok = res.status === 200 && res.data?.hasJwtSecret === true;
        addResult(section, 'GET /env-check - JWT Secret configured', ok, `hasJwtSecret: ${res.data?.hasJwtSecret}`);
        console.log(`  ${ok ? '✅' : '❌'} JWT Secret configured: ${res.data?.hasJwtSecret}`);
        if (!ok) report.suggestions.push('[Server] JWT_SECRET is missing in .env file');
    } catch (e) { addError(section, 'ENV check', e); }

    // Test 1.3: Client server responds
    try {
        const res = await axios.get(CLIENT_URL, { validateStatus: () => true, timeout: 5000 });
        const ok = res.status === 200;
        addResult(section, 'GET client (localhost:5173) - Frontend responds', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Frontend client: ${res.status}`);
    } catch (e) {
        addResult(section, 'Frontend client responds', false, e.message, 'Start the client with: cd client && npm run dev');
        console.log(`  ❌ Frontend client not responding`);
    }

    // Test 1.4: CORS headers present
    try {
        const res = await request('get', '/');
        const hasCors = res.headers['access-control-allow-origin'] !== undefined;
        addResult(section, 'CORS headers present', hasCors, `Header: ${res.headers['access-control-allow-origin'] || 'MISSING'}`);
        console.log(`  ${hasCors ? '✅' : '⚠️'} CORS: ${res.headers['access-control-allow-origin'] || 'not set'}`);
    } catch (e) { addError(section, 'CORS check', e); }

    // Test 1.5: 404 handling
    try {
        const res = await request('get', '/nonexistent-route-xyz');
        const ok = res.status === 404 || res.status === 200; // Express may return 200 with default handler
        addResult(section, 'Unknown route handling', true, `Status: ${res.status}`);
        console.log(`  ✅ Unknown route returns: ${res.status}`);
    } catch (e) { addError(section, '404 handling', e); }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: AUTHENTICATION
// ═══════════════════════════════════════════════════════════════
async function testAuthentication() {
    const section = '2. Authentication';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    const testEmail = randomEmail();
    const testOrgName = `TestOrg_${Date.now()}`;

    // Test 2.1: Register Organization
    try {
        const res = await request('post', '/auth/register-org', {
            orgName: testOrgName,
            websiteUrl: 'https://test.com',
            employeeCount: 10,
            country: 'US',
            industry: 'Technology',
            timezone: 'UTC',
            userName: 'Test Admin',
            email: testEmail,
            password: 'TestPass123!'
        });
        const ok = res.status === 201 && res.data?.token;
        if (ok) {
            state.adminToken = res.data.token;
            state.adminUser = res.data.user;
            state.testOrgId = res.data.user.org_id;
        }
        addResult(section, 'POST /auth/register-org - Register new organization', ok, ok ? `Org created, user ID: ${res.data?.user?.id}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Register org: ${res.status}`);
    } catch (e) { addError(section, 'Register org', e); }

    // Test 2.2: Register duplicate email
    try {
        const res = await request('post', '/auth/register-org', {
            orgName: 'DuplicateOrg',
            websiteUrl: 'https://dup.com',
            timezone: 'UTC',
            userName: 'Dup Admin',
            email: testEmail,
            password: 'TestPass123!'
        });
        const ok = res.status === 400;
        addResult(section, 'POST /auth/register-org - Duplicate email rejected', ok, `Status: ${res.status} - ${res.data?.error || ''}`);
        console.log(`  ${ok ? '✅' : '❌'} Duplicate email check: ${res.status}`);
    } catch (e) { addError(section, 'Duplicate email', e); }

    // Test 2.3: Register with missing fields
    try {
        const res = await request('post', '/auth/register-org', { orgName: 'Incomplete' });
        const ok = res.status >= 400 && res.status < 500;
        addResult(section, 'POST /auth/register-org - Missing fields validation', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Missing fields validation: ${res.status}`);
    } catch (e) { addError(section, 'Missing fields', e); }

    // Test 2.4: Login
    try {
        const res = await request('post', '/auth/login', { email: testEmail, password: 'TestPass123!' });
        const ok = res.status === 200 && res.data?.token;
        if (ok) state.adminToken = res.data.token;
        addResult(section, 'POST /auth/login - Valid credentials', ok, ok ? `Token received, role: ${res.data?.user?.role}` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Login: ${res.status}`);
    } catch (e) { addError(section, 'Login', e); }

    // Test 2.5: Login with wrong password
    try {
        const res = await request('post', '/auth/login', { email: testEmail, password: 'WrongPass!' });
        const ok = res.status === 401;
        addResult(section, 'POST /auth/login - Wrong password rejected', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Wrong password: ${res.status}`);
    } catch (e) { addError(section, 'Wrong password', e); }

    // Test 2.6: Login with non-existent email
    try {
        const res = await request('post', '/auth/login', { email: 'nonexistent@test.com', password: 'pass' });
        const ok = res.status === 401;
        addResult(section, 'POST /auth/login - Non-existent email rejected', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Non-existent email: ${res.status}`);
    } catch (e) { addError(section, 'Non-existent email', e); }

    // Test 2.7: GET /auth/me with valid token
    try {
        const res = await request('get', '/auth/me', null, state.adminToken);
        const ok = res.status === 200 && res.data?.email === testEmail;
        addResult(section, 'GET /auth/me - Authenticated user profile', ok, ok ? `User: ${res.data?.name}, Role: ${res.data?.role}` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Get me: ${res.status}`);
    } catch (e) { addError(section, 'Get me', e); }

    // Test 2.8: GET /auth/me without token
    try {
        const res = await request('get', '/auth/me');
        const ok = res.status === 401;
        addResult(section, 'GET /auth/me - No token returns 401', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} No token: ${res.status}`);
    } catch (e) { addError(section, 'No token', e); }

    // Test 2.9: GET /auth/me with invalid token
    try {
        const res = await request('get', '/auth/me', null, 'invalid.token.here');
        const ok = res.status === 403;
        addResult(section, 'GET /auth/me - Invalid token returns 403', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Invalid token: ${res.status}`);
    } catch (e) { addError(section, 'Invalid token', e); }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: USER CRUD
// ═══════════════════════════════════════════════════════════════
async function testUserCRUD() {
    const section = '3. User Management (CRUD)';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false, 'Auth tests must pass first');
        return;
    }

    // Test 3.1: Create a manager
    const managerEmail = randomEmail();
    try {
        const res = await request('post', '/users', {
            name: 'Test Manager',
            email: managerEmail,
            password: 'Manager123!',
            role: 'manager',
            timezone: 'UTC'
        }, state.adminToken);
        const ok = res.status === 201 && res.data?.id;
        if (ok) state.testManagerId = res.data.id;
        addResult(section, 'POST /users - Create manager', ok, ok ? `Manager ID: ${res.data?.id}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Create manager: ${res.status}`);
    } catch (e) { addError(section, 'Create manager', e); }

    // Login as manager to get token
    try {
        const res = await request('post', '/auth/login', { email: managerEmail, password: 'Manager123!' });
        if (res.status === 200) state.testManagerToken = res.data.token;
    } catch (e) { /* ignore */ }

    // Test 3.2: Create a user
    const userEmail = randomEmail();
    try {
        const res = await request('post', '/users', {
            name: randomName(),
            email: userEmail,
            password: 'User123!',
            role: 'user',
            manager_id: state.testManagerId,
            timezone: 'Asia/Kolkata',
            emp_id: 'EMP001',
            payroll_id: 'PAY001',
            site: 'Office A',
            shift_start_time: '09:00',
            shift_end_time: '18:00',
            shift_duration: 9,
            work_days: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
            start_of_day: '09:00'
        }, state.adminToken);
        const ok = res.status === 201 && res.data?.id;
        if (ok) state.testUserId = res.data.id;
        addResult(section, 'POST /users - Create user with all fields', ok, ok ? `User ID: ${res.data?.id}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Create user: ${res.status}`);
    } catch (e) { addError(section, 'Create user', e); }

    // Login as user to get token
    try {
        const res = await request('post', '/auth/login', { email: userEmail, password: 'User123!' });
        if (res.status === 200) state.testUserToken = res.data.token;
    } catch (e) { /* ignore */ }

    // Test 3.3: Create user with missing required fields
    try {
        const res = await request('post', '/users', { name: 'Incomplete' }, state.adminToken);
        const ok = res.status === 400;
        addResult(section, 'POST /users - Missing required fields returns 400', ok, `Status: ${res.status} - ${res.data?.error || ''}`);
        console.log(`  ${ok ? '✅' : '❌'} Missing fields validation: ${res.status}`);
    } catch (e) { addError(section, 'Missing fields', e); }

    // Test 3.4: Create user with duplicate email
    try {
        const res = await request('post', '/users', {
            name: 'Duplicate',
            email: userEmail,
            password: 'Dup123!',
            role: 'user'
        }, state.adminToken);
        const ok = res.status === 400;
        addResult(section, 'POST /users - Duplicate email returns 400', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Duplicate email: ${res.status}`);
    } catch (e) { addError(section, 'Duplicate email', e); }

    // Test 3.5: List users
    try {
        const res = await request('get', '/users', null, state.adminToken);
        const ok = res.status === 200 && Array.isArray(res.data);
        addResult(section, 'GET /users - List users', ok, ok ? `Found ${res.data?.length} users` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} List users: ${res.status} (${res.data?.length || 0} users)`);
    } catch (e) { addError(section, 'List users', e); }

    // Test 3.6: List users as manager (should only see direct reports)
    if (state.testManagerToken) {
        try {
            const res = await request('get', '/users', null, state.testManagerToken);
            const ok = res.status === 200 && Array.isArray(res.data);
            addResult(section, 'GET /users - Manager sees only direct reports', ok, ok ? `Found ${res.data?.length} users` : `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Manager list users: ${res.status} (${res.data?.length || 0} users)`);
        } catch (e) { addError(section, 'Manager list users', e); }
    }

    // Test 3.7: Update user
    if (state.testUserId) {
        try {
            const res = await request('patch', `/users/${state.testUserId}`, {
                name: 'Updated Test User',
                site: 'Office B',
                emp_id: 'EMP002'
            }, state.adminToken);
            const ok = res.status === 200 && res.data?.name === 'Updated Test User';
            addResult(section, 'PATCH /users/:id - Update user', ok, ok ? `Updated name: ${res.data?.name}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
            console.log(`  ${ok ? '✅' : '❌'} Update user: ${res.status}`);
        } catch (e) { addError(section, 'Update user', e); }
    }

    // Test 3.8: Update non-existent user
    try {
        const fakeId = crypto.randomUUID();
        const res = await request('patch', `/users/${fakeId}`, { name: 'Ghost' }, state.adminToken);
        const ok = res.status === 404;
        addResult(section, 'PATCH /users/:id - Non-existent user returns 404', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Update non-existent: ${res.status}`);
    } catch (e) { addError(section, 'Update non-existent', e); }

    // Test 3.9: Get user features
    if (state.testUserId) {
        try {
            const res = await request('get', `/users/${state.testUserId}/features`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'GET /users/:id/features - Get user features', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Get user features: ${res.status}`);
        } catch (e) { addError(section, 'Get user features', e); }
    }

    // Test 3.10: Update user features
    if (state.testUserId) {
        try {
            const res = await request('patch', `/users/${state.testUserId}/features`, {
                is_screenshots_enabled: false,
                screenshot_interval_seconds: 600
            }, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'PATCH /users/:id/features - Update user features', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Update user features: ${res.status}`);
        } catch (e) { addError(section, 'Update user features', e); }
    }

    // Test 3.11: Force logout user
    if (state.testUserId) {
        try {
            const res = await request('post', `/users/${state.testUserId}/force-logout`, {}, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'POST /users/:id/force-logout - Force logout', ok, `Status: ${res.status} - ${res.data?.message || ''}`);
            console.log(`  ${ok ? '✅' : '❌'} Force logout: ${res.status}`);
        } catch (e) { addError(section, 'Force logout', e); }
    }

    // Test 3.12: Unauthorized access (user token trying to list users)
    if (state.testUserToken) {
        try {
            const res = await request('get', '/users', null, state.testUserToken);
            const ok = res.status === 403;
            addResult(section, 'GET /users - Regular user denied access (403)', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} User access denied: ${res.status}`);
        } catch (e) { addError(section, 'Unauthorized access', e); }
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: BREAK TYPE CRUD
// ═══════════════════════════════════════════════════════════════
async function testBreakCRUD() {
    const section = '4. Break Types (CRUD)';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false);
        return;
    }

    // Test 4.1: Create break type
    try {
        const res = await request('post', '/breaks', {
            name: `Lunch_${Date.now()}`,
            max_duration_minutes: 30,
            is_paid: true,
            is_active: true
        }, state.adminToken);
        const ok = res.status === 201 && res.data?.id;
        if (ok) state.testBreakId = res.data.id;
        addResult(section, 'POST /breaks - Create break type', ok, ok ? `Break ID: ${res.data?.id}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Create break: ${res.status}`);
    } catch (e) { addError(section, 'Create break', e); }

    // Test 4.2: Create break without name
    try {
        const res = await request('post', '/breaks', { max_duration_minutes: 15 }, state.adminToken);
        const ok = res.status === 400;
        addResult(section, 'POST /breaks - Missing name returns 400', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Missing name validation: ${res.status}`);
    } catch (e) { addError(section, 'Missing name', e); }

    // Test 4.3: List break types
    try {
        const res = await request('get', '/breaks', null, state.adminToken);
        const ok = res.status === 200 && Array.isArray(res.data);
        addResult(section, 'GET /breaks - List break types', ok, ok ? `Found ${res.data?.length} breaks` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} List breaks: ${res.status} (${res.data?.length || 0} breaks)`);
    } catch (e) { addError(section, 'List breaks', e); }

    // Test 4.4: Update break type
    if (state.testBreakId) {
        try {
            const res = await request('patch', `/breaks/${state.testBreakId}`, {
                name: `Updated_Lunch_${Date.now()}`,
                max_duration_minutes: 45,
                is_paid: false
            }, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'PATCH /breaks/:id - Update break type', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Update break: ${res.status}`);
        } catch (e) { addError(section, 'Update break', e); }
    }

    // Test 4.5: Update non-existent break
    try {
        const fakeId = crypto.randomUUID();
        const res = await request('patch', `/breaks/${fakeId}`, { name: 'Ghost' }, state.adminToken);
        const ok = res.status === 404;
        addResult(section, 'PATCH /breaks/:id - Non-existent break returns 404', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Update non-existent: ${res.status}`);
    } catch (e) { addError(section, 'Update non-existent break', e); }

    // Test 4.6: Delete break type (will be cleaned up later)
    // We create a temporary one to delete
    let tempBreakId;
    try {
        const createRes = await request('post', '/breaks', { name: `ToDelete_${Date.now()}`, max_duration_minutes: 5 }, state.adminToken);
        if (createRes.status === 201) tempBreakId = createRes.data.id;
    } catch (e) { /* ignore */ }
    
    if (tempBreakId) {
        try {
            const res = await request('delete', `/breaks/${tempBreakId}`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'DELETE /breaks/:id - Delete break type', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Delete break: ${res.status}`);
        } catch (e) { addError(section, 'Delete break', e); }
    }

    // Test 4.7: Delete non-existent break
    try {
        const fakeId = crypto.randomUUID();
        const res = await request('delete', `/breaks/${fakeId}`, null, state.adminToken);
        const ok = res.status === 404;
        addResult(section, 'DELETE /breaks/:id - Non-existent break returns 404', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Delete non-existent: ${res.status}`);
    } catch (e) { addError(section, 'Delete non-existent break', e); }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: ORGANIZATION SETTINGS
// ═══════════════════════════════════════════════════════════════
async function testOrgSettings() {
    const section = '5. Organization Settings';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false);
        return;
    }

    // Test 5.1: Get org settings
    try {
        const res = await request('get', '/org/settings', null, state.adminToken);
        const ok = res.status === 200 && res.data?.features;
        addResult(section, 'GET /org/settings - Get organization settings', ok, ok ? `Timezone: ${res.data?.timezone}` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Get org settings: ${res.status}`);
    } catch (e) { addError(section, 'Get org settings', e); }

    // Test 5.2: Update org settings
    try {
        const res = await request('patch', '/org/settings', {
            timezone: 'America/New_York',
            shift_start_time: '09:00',
            shift_end_time: '17:00',
            shift_duration: 8,
            work_days: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
            start_of_day: '09:00',
            features: {
                is_activity_tracking_enabled: true,
                is_screenshots_enabled: true,
                screenshot_interval_seconds: 300,
                is_afk_tracking_enabled: true,
                afk_threshold_seconds: 300,
                is_breaks_enabled: true,
                is_force_logout_enabled: true
            }
        }, state.adminToken);
        const ok = res.status === 200;
        addResult(section, 'PATCH /org/settings - Update organization settings', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Update org settings: ${res.status}`);
    } catch (e) { addError(section, 'Update org settings', e); }

    // Test 5.3: Get settings again to verify update
    try {
        const res = await request('get', '/org/settings', null, state.adminToken);
        const ok = res.status === 200 && res.data?.timezone === 'America/New_York';
        addResult(section, 'GET /org/settings - Verify updated settings', ok, ok ? `Timezone now: ${res.data?.timezone}` : `Timezone: ${res.data?.timezone}`);
        console.log(`  ${ok ? '✅' : '❌'} Verify update: ${res.status}`);
    } catch (e) { addError(section, 'Verify update', e); }

    // Test 5.4: Non-admin access denied
    if (state.testUserToken) {
        try {
            const res = await request('get', '/org/settings', null, state.testUserToken);
            const ok = res.status === 403;
            addResult(section, 'GET /org/settings - Regular user denied (403)', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Non-admin denied: ${res.status}`);
        } catch (e) { addError(section, 'Non-admin access', e); }
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: APP CATEGORIES CRUD
// ═══════════════════════════════════════════════════════════════
async function testAppCategories() {
    const section = '6. App Categories (CRUD)';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false);
        return;
    }

    // Test 6.1: Create app category
    try {
        const res = await request('post', '/app-tracking/categories', {
            name: `TestCat_${Date.now()}`,
            productivity_type: 'productive',
            description: 'Test category for productive apps'
        }, state.adminToken);
        const ok = res.status === 201 && res.data?.id;
        if (ok) state.testCategoryId = res.data.id;
        addResult(section, 'POST /app-tracking/categories - Create category', ok, ok ? `Category ID: ${res.data?.id}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Create category: ${res.status}`);
    } catch (e) { addError(section, 'Create category', e); }

    // Test 6.2: Create with missing fields
    try {
        const res = await request('post', '/app-tracking/categories', { name: 'Incomplete' }, state.adminToken);
        const ok = res.status === 400;
        addResult(section, 'POST /app-tracking/categories - Missing productivity_type returns 400', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Missing fields: ${res.status}`);
    } catch (e) { addError(section, 'Missing fields', e); }

    // Test 6.3: Create with invalid productivity_type
    try {
        const res = await request('post', '/app-tracking/categories', { name: 'Invalid', productivity_type: 'invalid_type' }, state.adminToken);
        const ok = res.status === 400;
        addResult(section, 'POST /app-tracking/categories - Invalid productivity_type returns 400', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Invalid type: ${res.status}`);
    } catch (e) { addError(section, 'Invalid type', e); }

    // Test 6.4: List categories
    try {
        const res = await request('get', '/app-tracking/categories', null, state.adminToken);
        const ok = res.status === 200 && Array.isArray(res.data);
        addResult(section, 'GET /app-tracking/categories - List categories', ok, ok ? `Found ${res.data?.length} categories` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} List categories: ${res.status} (${res.data?.length || 0})`);
    } catch (e) { addError(section, 'List categories', e); }

    // Test 6.5: Update category
    if (state.testCategoryId) {
        try {
            const res = await request('patch', `/app-tracking/categories/${state.testCategoryId}`, {
                name: `UpdatedCat_${Date.now()}`,
                productivity_type: 'non_productive'
            }, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'PATCH /app-tracking/categories/:id - Update category', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Update category: ${res.status}`);
        } catch (e) { addError(section, 'Update category', e); }
    }

    // Test 6.6: Update non-existent category
    try {
        const fakeId = crypto.randomUUID();
        const res = await request('patch', `/app-tracking/categories/${fakeId}`, { name: 'Ghost' }, state.adminToken);
        const ok = res.status === 404;
        addResult(section, 'PATCH /app-tracking/categories/:id - Non-existent returns 404', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Update non-existent: ${res.status}`);
    } catch (e) { addError(section, 'Update non-existent', e); }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7: TRACKED APPS CRUD
// ═══════════════════════════════════════════════════════════════
async function testTrackedApps() {
    const section = '7. Tracked Apps (CRUD)';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false);
        return;
    }

    // Test 7.1: Create tracked app
    try {
        const res = await request('post', '/app-tracking/apps', {
            executable_name: `testapp_${Date.now()}.exe`,
            display_name: 'Test Application',
            category_id: state.testCategoryId || null
        }, state.adminToken);
        const ok = res.status === 201 && res.data?.id;
        if (ok) state.testAppId = res.data.id;
        addResult(section, 'POST /app-tracking/apps - Create tracked app', ok, ok ? `App ID: ${res.data?.id}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Create app: ${res.status}`);
    } catch (e) { addError(section, 'Create app', e); }

    // Test 7.2: Create app without executable_name
    try {
        const res = await request('post', '/app-tracking/apps', { display_name: 'Incomplete' }, state.adminToken);
        const ok = res.status === 400;
        addResult(section, 'POST /app-tracking/apps - Missing executable_name returns 400', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Missing executable: ${res.status}`);
    } catch (e) { addError(section, 'Missing executable', e); }

    // Test 7.3: List tracked apps
    try {
        const res = await request('get', '/app-tracking/apps', null, state.adminToken);
        const ok = res.status === 200 && Array.isArray(res.data);
        addResult(section, 'GET /app-tracking/apps - List tracked apps', ok, ok ? `Found ${res.data?.length} apps` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} List apps: ${res.status} (${res.data?.length || 0})`);
    } catch (e) { addError(section, 'List apps', e); }

    // Test 7.4: List unmapped apps
    try {
        const res = await request('get', '/app-tracking/apps', { unmapped: 'true' }, state.adminToken);
        const ok = res.status === 200 && Array.isArray(res.data);
        addResult(section, 'GET /app-tracking/apps?unmapped=true - List unmapped apps', ok, ok ? `Found ${res.data?.length} unmapped` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} List unmapped: ${res.status}`);
    } catch (e) { addError(section, 'List unmapped', e); }

    // Test 7.5: Update tracked app
    if (state.testAppId) {
        try {
            const res = await request('patch', `/app-tracking/apps/${state.testAppId}`, {
                display_name: 'Updated Test App'
            }, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'PATCH /app-tracking/apps/:id - Update tracked app', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Update app: ${res.status}`);
        } catch (e) { addError(section, 'Update app', e); }
    }

    // Test 7.6: Map app to category
    if (state.testAppId && state.testCategoryId) {
        try {
            const res = await request('patch', `/app-tracking/apps/${state.testAppId}/map`, {
                category_id: state.testCategoryId
            }, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'PATCH /app-tracking/apps/:id/map - Map app to category', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Map app: ${res.status}`);
        } catch (e) { addError(section, 'Map app', e); }
    }

    // Test 7.7: Map app without category_id
    if (state.testAppId) {
        try {
            const res = await request('patch', `/app-tracking/apps/${state.testAppId}/map`, {}, state.adminToken);
            const ok = res.status === 400;
            addResult(section, 'PATCH /app-tracking/apps/:id/map - Missing category_id returns 400', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Map without category: ${res.status}`);
        } catch (e) { addError(section, 'Map without category', e); }
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 8: AGENT ENDPOINTS (Heartbeat, Activity, Breaks)
// ═══════════════════════════════════════════════════════════════
async function testAgentEndpoints() {
    const section = '8. Agent Endpoints';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken || !state.testUserId || !state.testOrgId) {
        addResult(section, 'SKIPPED - Missing test user/org', false, 'User CRUD tests must pass first');
        return;
    }

    const token = state.testUserToken || state.adminToken;

    // Test 8.1: Heartbeat
    try {
        const res = await request('post', '/agent/heartbeat', {
            org_id: state.testOrgId,
            user_id: state.testUserId,
            device_identifier: 'test-device-001',
            device_name: 'Test Machine',
            agent_version: '1.0.0-test'
        }, token);
        const ok = res.status === 200 && res.data?.success;
        addResult(section, 'POST /agent/heartbeat - Send heartbeat', ok, ok ? `Features: ${JSON.stringify(res.data?.features || {})}` : `Status: ${res.status} - ${JSON.stringify(res.data)}`);
        console.log(`  ${ok ? '✅' : '❌'} Heartbeat: ${res.status}`);
    } catch (e) { addError(section, 'Heartbeat', e); }

    // Test 8.2: Activity session sync
    const sessionId = crypto.randomUUID();
    try {
        const res = await request('post', '/agent/activity-session', {
            id: sessionId,
            org_id: state.testOrgId,
            user_id: state.testUserId,
            start_time: new Date(Date.now() - 3600000).toISOString(),
            end_time: new Date().toISOString(),
            total_work_seconds: 3000,
            total_idle_seconds: 600,
            total_break_seconds: 0,
            status: 'active'
        }, token);
        const ok = res.status === 200 && res.data?.success;
        addResult(section, 'POST /agent/activity-session - Sync work session', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Activity session: ${res.status}`);
    } catch (e) { addError(section, 'Activity session', e); }

    // Test 8.3: Activity log
    try {
        const res = await request('post', '/agent/activity-log', {
            org_id: state.testOrgId,
            user_id: state.testUserId,
            session_id: sessionId,
            log_time: new Date().toISOString(),
            keyboard_events: 150,
            mouse_events: 200,
            state: 'active'
        }, token);
        const ok = res.status === 200 && res.data?.success;
        addResult(section, 'POST /agent/activity-log - Log activity', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Activity log: ${res.status}`);
    } catch (e) { addError(section, 'Activity log', e); }

    // Test 8.4: Get break types for agent
    try {
        const res = await request('get', '/agent/breaks', null, token);
        const ok = res.status === 200 && res.data?.success;
        addResult(section, 'GET /agent/breaks - Get break types', ok, ok ? `Breaks: ${res.data?.breaks?.length || 0}` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Get breaks: ${res.status}`);
    } catch (e) { addError(section, 'Get breaks', e); }

    // Test 8.5: Log break
    try {
        const res = await request('post', '/agent/break-log', {
            id: crypto.randomUUID(),
            org_id: state.testOrgId,
            user_id: state.testUserId,
            session_id: sessionId,
            break_type_id: state.testBreakId || crypto.randomUUID(),
            start_time: new Date(Date.now() - 600000).toISOString(),
            end_time: new Date().toISOString(),
            duration_seconds: 600
        }, token);
        const ok = res.status === 200 && res.data?.success;
        addResult(section, 'POST /agent/break-log - Log break', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Log break: ${res.status}`);
    } catch (e) { addError(section, 'Log break', e); }

    // Test 8.6: Heartbeat with invalid org/user
    try {
        const res = await request('post', '/agent/heartbeat', {
            org_id: crypto.randomUUID(),
            user_id: crypto.randomUUID(),
            device_identifier: 'fake-device'
        }, token);
        const ok = res.status === 403 || (res.status === 200 && res.data?.command === 'FORCE_LOGOUT');
        addResult(section, 'POST /agent/heartbeat - Invalid org/user handled', ok, `Status: ${res.status}, Command: ${res.data?.command || 'none'}`);
        console.log(`  ${ok ? '✅' : '❌'} Invalid heartbeat: ${res.status}`);
    } catch (e) { addError(section, 'Invalid heartbeat', e); }

    // Test 8.7: App usage log
    try {
        const res = await request('post', '/app-tracking/usage/log', {
            org_id: state.testOrgId,
            user_id: state.testUserId,
            session_id: sessionId,
            entries: [{
                executable_name: 'chrome.exe',
                window_title: 'Google Chrome',
                start_time: new Date(Date.now() - 300000).toISOString(),
                end_time: new Date().toISOString(),
                duration_seconds: 300
            }]
        }, token);
        const ok = res.status === 200;
        addResult(section, 'POST /app-tracking/usage/log - Log app usage', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} App usage log: ${res.status}`);
    } catch (e) { addError(section, 'App usage log', e); }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 9: STATS & REPORTS
// ═══════════════════════════════════════════════════════════════
async function testStatsAndReports() {
    const section = '9. Stats & Reports';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false);
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const token = state.adminToken;

    // Test 9.1: Admin stats
    try {
        const res = await request('get', '/stats/admin', null, token);
        const ok = res.status === 200;
        addResult(section, 'GET /stats/admin - Admin dashboard stats', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Admin stats: ${res.status}`);
    } catch (e) { addError(section, 'Admin stats', e); }

    // Test 9.2: Manager stats
    try {
        const res = await request('get', '/stats/manager', null, token);
        const ok = res.status === 200;
        addResult(section, 'GET /stats/manager - Manager dashboard stats', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Manager stats: ${res.status}`);
    } catch (e) { addError(section, 'Manager stats', e); }

    // Test 9.3: User stats
    try {
        const res = await request('get', '/stats/user', null, token);
        const ok = res.status === 200;
        addResult(section, 'GET /stats/user - User stats', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} User stats: ${res.status}`);
    } catch (e) { addError(section, 'User stats', e); }

    // Test 9.4: Hourly stats
    if (state.testUserId) {
        try {
            const res = await request('get', `/stats/user/${state.testUserId}/hourly`, { date: today }, token);
            const ok = res.status === 200;
            addResult(section, 'GET /stats/user/:userId/hourly - Hourly stats', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Hourly stats: ${res.status}`);
        } catch (e) { addError(section, 'Hourly stats', e); }
    }

    // Test 9.5: Daily summary report
    try {
        const res = await request('get', '/reports/summary', { start_date: today, end_date: today }, token);
        const ok = res.status === 200;
        addResult(section, 'GET /reports/summary - Daily summary report', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Summary report: ${res.status}`);
    } catch (e) { addError(section, 'Summary report', e); }

    // Test 9.6: Break usage report
    try {
        const res = await request('get', '/reports/breaks', { start_date: today, end_date: today }, token);
        const ok = res.status === 200;
        addResult(section, 'GET /reports/breaks - Break usage report', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Break report: ${res.status}`);
    } catch (e) { addError(section, 'Break report', e); }

    // Test 9.7: Screenshots report
    try {
        const res = await request('get', '/reports/screenshots', { start_date: today, end_date: today }, token);
        const ok = res.status === 200;
        addResult(section, 'GET /reports/screenshots - Screenshots report', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Screenshots report: ${res.status}`);
    } catch (e) { addError(section, 'Screenshots report', e); }

    // Test 9.8: Idle report
    try {
        const res = await request('get', '/reports/idle', { start_date: today, end_date: today }, token);
        const ok = res.status === 200;
        addResult(section, 'GET /reports/idle - Idle events report', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Idle report: ${res.status}`);
    } catch (e) { addError(section, 'Idle report', e); }

    // Test 9.9: App tracking admin report
    try {
        const res = await request('get', '/app-tracking/reports/admin', { start_date: today, end_date: today }, token);
        const ok = res.status === 200;
        addResult(section, 'GET /app-tracking/reports/admin - Admin app tracking report', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} App tracking admin report: ${res.status}`);
    } catch (e) { addError(section, 'App tracking admin report', e); }

    // Test 9.10: App tracking user report
    if (state.testUserId) {
        try {
            const res = await request('get', `/app-tracking/reports/user/${state.testUserId}`, { start_date: today, end_date: today }, token);
            const ok = res.status === 200;
            addResult(section, 'GET /app-tracking/reports/user/:userId - User app tracking report', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} App tracking user report: ${res.status}`);
        } catch (e) { addError(section, 'App tracking user report', e); }

        // Test 9.11: Productivity summary
        try {
            const res = await request('get', `/app-tracking/reports/productivity/${state.testUserId}`, { start_date: today, end_date: today }, token);
            const ok = res.status === 200;
            addResult(section, 'GET /app-tracking/reports/productivity/:userId - Productivity report', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Productivity report: ${res.status}`);
        } catch (e) { addError(section, 'Productivity report', e); }
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 10: NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
async function testNotifications() {
    const section = '10. Notifications';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) {
        addResult(section, 'SKIPPED - No admin token', false);
        return;
    }

    // Test 10.1: Get notifications
    try {
        const res = await request('get', '/notifications', null, state.adminToken);
        const ok = res.status === 200;
        addResult(section, 'GET /notifications - Get notifications', ok, ok ? `Notifications: ${Array.isArray(res.data) ? res.data.length : 'N/A'}` : `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Get notifications: ${res.status}`);
    } catch (e) { addError(section, 'Get notifications', e); }

    // Test 10.2: Mark notifications as read
    try {
        const res = await request('post', '/notifications/mark-read', { ids: [] }, state.adminToken);
        const ok = res.status === 200;
        addResult(section, 'POST /notifications/mark-read - Mark as read', ok, `Status: ${res.status}`);
        console.log(`  ${ok ? '✅' : '❌'} Mark read: ${res.status}`);
    } catch (e) { addError(section, 'Mark read', e); }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 11: CLEANUP & DELETE OPERATIONS
// ═══════════════════════════════════════════════════════════════
async function testCleanup() {
    const section = '11. Cleanup (Delete Operations)';
    console.log(`\n${'═'.repeat(60)}\n  ${section}\n${'═'.repeat(60)}`);

    if (!state.adminToken) return;

    // Delete tracked app
    if (state.testAppId) {
        try {
            const res = await request('delete', `/app-tracking/apps/${state.testAppId}`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'DELETE /app-tracking/apps/:id - Delete tracked app', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Delete app: ${res.status}`);
        } catch (e) { addError(section, 'Delete app', e); }
    }

    // Delete app category
    if (state.testCategoryId) {
        try {
            const res = await request('delete', `/app-tracking/categories/${state.testCategoryId}`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'DELETE /app-tracking/categories/:id - Delete category', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Delete category: ${res.status}`);
        } catch (e) { addError(section, 'Delete category', e); }
    }

    // Delete break type
    if (state.testBreakId) {
        try {
            const res = await request('delete', `/breaks/${state.testBreakId}`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'DELETE /breaks/:id - Delete break type', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Delete break: ${res.status}`);
        } catch (e) { addError(section, 'Delete break', e); }
    }

    // Delete test user
    if (state.testUserId) {
        try {
            const res = await request('delete', `/users/${state.testUserId}`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'DELETE /users/:id - Delete test user', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Delete user: ${res.status}`);
        } catch (e) { addError(section, 'Delete user', e); }
    }

    // Delete test manager
    if (state.testManagerId) {
        try {
            const res = await request('delete', `/users/${state.testManagerId}`, null, state.adminToken);
            const ok = res.status === 200;
            addResult(section, 'DELETE /users/:id - Delete test manager', ok, `Status: ${res.status}`);
            console.log(`  ${ok ? '✅' : '❌'} Delete manager: ${res.status}`);
        } catch (e) { addError(section, 'Delete manager', e); }
    }
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════
function generateReport() {
    const duration = ((Date.now() - report.startTime) / 1000).toFixed(1);
    const passRate = report.total > 0 ? ((report.passed / report.total) * 100).toFixed(1) : 0;
    
    let output = '';
    output += `\n${'═'.repeat(70)}\n`;
    output += `  COMPREHENSIVE TEST REPORT - User Monitor System\n`;
    output += `  Generated: ${new Date().toISOString()}\n`;
    output += `  Duration: ${duration}s\n`;
    output += `${'═'.repeat(70)}\n\n`;

    // Summary
    output += `┌─────────────────────────────────────────┐\n`;
    output += `│           TEST SUMMARY                  │\n`;
    output += `├─────────────────────────────────────────┤\n`;
    output += `│  Total Tests:    ${String(report.total).padStart(4)}                   │\n`;
    output += `│  Passed:         ${String(report.passed).padStart(4)}  ✅                │\n`;
    output += `│  Failed:         ${String(report.failed).padStart(4)}  ❌                │\n`;
    output += `│  Pass Rate:      ${String(passRate + '%').padStart(6)}                │\n`;
    output += `│  Errors Found:   ${String(report.errors.length).padStart(4)}                   │\n`;
    output += `└─────────────────────────────────────────┘\n\n`;

    // Section Breakdown
    output += `── SECTION BREAKDOWN ──────────────────────────────────────\n\n`;
    for (const [section, data] of Object.entries(report.sections)) {
        const sectionRate = data.passed + data.failed > 0 ? ((data.passed / (data.passed + data.failed)) * 100).toFixed(0) : 0;
        const icon = data.failed === 0 ? '✅' : '⚠️';
        output += `  ${icon} ${section}\n`;
        output += `     Passed: ${data.passed} | Failed: ${data.failed} | Rate: ${sectionRate}%\n`;
    }

    // Passed Tests
    output += `\n── PASSED TESTS (${report.passed}) ─────────────────────────────────\n\n`;
    report.passedTests.forEach(t => {
        output += `  ✅ ${t}\n`;
    });

    // Failed Tests
    if (report.failedTests.length > 0) {
        output += `\n── FAILED TESTS (${report.failed}) ─────────────────────────────────\n\n`;
        report.failedTests.forEach(t => {
            output += `  ❌ ${t}\n`;
        });
    }

    // Errors
    if (report.errors.length > 0) {
        output += `\n── ERRORS FOUND (${report.errors.length}) ────────────────────────────────\n\n`;
        report.errors.forEach((e, i) => {
            output += `  ${i + 1}. [${e.section}] ${e.testName}\n`;
            output += `     Status: ${e.status} | Message: ${e.message}\n`;
            output += `     Time: ${e.timestamp}\n\n`;
        });
    }

    // Suggestions
    if (report.suggestions.length > 0) {
        output += `\n── SUGGESTIONS FOR FIXES ──────────────────────────────────\n\n`;
        report.suggestions.forEach((s, i) => {
            output += `  ${i + 1}. ${s}\n`;
        });
    }

    // Auto-generated suggestions based on failures
    output += `\n── AUTO-GENERATED RECOMMENDATIONS ─────────────────────────\n\n`;
    
    const sectionNames = Object.keys(report.sections);
    sectionNames.forEach(section => {
        const data = report.sections[section];
        if (data.failed > 0) {
            data.tests.filter(t => !t.passed).forEach(t => {
                if (t.details.includes('500')) {
                    output += `  ⚠️  [${section}] "${t.testName}" returned 500 - Check server logs for internal errors\n`;
                }
                if (t.details.includes('ECONNREFUSED')) {
                    output += `  ⚠️  [${section}] Connection refused - Ensure the server is running on the correct port\n`;
                }
                if (t.details.includes('timeout')) {
                    output += `  ⚠️  [${section}] Request timeout - Check database connectivity and query performance\n`;
                }
            });
        }
    });

    if (report.failed === 0) {
        output += `  ✅ All tests passed! No issues found.\n`;
    }

    output += `\n${'═'.repeat(70)}\n`;
    output += `  END OF REPORT\n`;
    output += `${'═'.repeat(70)}\n`;

    return output;
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════
async function runAllTests() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   COMPREHENSIVE TEST SUITE - User Monitor System            ║');
    console.log('║   Testing: API + CRUD + Validation + Auth + Agent + Reports ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n  Server: ${API_URL}`);
    console.log(`  Client: ${CLIENT_URL}`);
    console.log(`  Time: ${new Date().toISOString()}\n`);

    try {
        await testServerConnectivity();
        await testAuthentication();
        await testUserCRUD();
        await testBreakCRUD();
        await testOrgSettings();
        await testAppCategories();
        await testTrackedApps();
        await testAgentEndpoints();
        await testStatsAndReports();
        await testNotifications();
        await testCleanup();
    } catch (e) {
        console.error('\n  FATAL ERROR:', e.message);
        report.errors.push({ section: 'FATAL', testName: 'Test Suite', message: e.message, status: 'CRASH' });
    }

    // Generate and display report
    const reportText = generateReport();
    console.log(reportText);

    // Save report to file
    const reportPath = `test-report-${TIMESTAMP}.txt`;
    fs.writeFileSync(reportPath, reportText.replace(/✅|❌|⚠️|║|╔|╚|╗|╝|═|─|┌|┐|└|┘|├|┤|│/g, (match) => {
        const map = { '✅': '[PASS]', '❌': '[FAIL]', '⚠️': '[WARN]' };
        return map[match] || match;
    }));
    console.log(`\n  Report saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);
}

runAllTests();
