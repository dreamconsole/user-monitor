import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3000';

async function testVisibilityAndCompat() {
    console.log('--- VISIBILITY AND BACKWARD COMPATIBILITY TEST ---');
    try {
        console.log('Logging in as OrgAdmin (user@acme.com)...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@acme.com', password: 'password123' })
        });
        const loginData = await loginRes.json();
        const orgAdminToken = loginData.token;

        // 1. Create a User with NO TEAM (Backward Compatibility Check)
        console.log('Creating a User with NO TEAM...');
        const noTeamRes = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orgAdminToken}` },
            body: JSON.stringify({
                name: 'Teamless User',
                email: `teamless_${Date.now()}@acme.com`,
                password: 'password123',
                role: 'user',
                emp_id: `TL-${Date.now()}`
            })
        });
        const noTeamUser = await noTeamRes.json();
        if (!noTeamRes.ok) throw new Error(`Teamless creation failed: ${JSON.stringify(noTeamUser)}`);
        console.log(`SUCCESS: Created teamless user ID: ${noTeamUser.id}`);

        // Get Users List (Should include teamless)
        const allUsersRes = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${orgAdminToken}` } });
        const allUsers = await allUsersRes.json();
        const foundTeamless = allUsers.find(u => u.id === noTeamUser.id);
        if (foundTeamless) {
            console.log('SUCCESS: Teamless user appears in OrgAdmin users list without crashing.');
        } else {
            console.error('FAILED: Teamless user missing from list.');
        }

        // 2. Create a Team
        const teamRes = await fetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orgAdminToken}` },
            body: JSON.stringify({ name: 'Alpha Team' })
        });
        const teamData = await teamRes.json();
        const teamId = teamData.id;

        // 3. Create a Manager for that Team
        const mgrRes = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orgAdminToken}` },
            body: JSON.stringify({
                name: 'Alpha Manager',
                email: `alphamgr_${Date.now()}@acme.com`,
                password: 'password123',
                role: 'manager',
                team_id: teamId,
                emp_id: `MGR-${Date.now()}`
            })
        });
        const mgrUser = await mgrRes.json();

        // Assign manager to team members list (wait, User creation doesn't add to members list automatically if we only set team_id? No, it does if team_id is set).
        console.log(`Created Alpha Manager ID: ${mgrUser.id}`);

        // Login as Alpha Manager
        const mgrLoginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: mgrUser.email, password: 'password123' })
        });
        const mgrToken = (await mgrLoginRes.json()).token;

        // 4. Test Manager Visibility
        console.log('Testing Manager visibility...');
        const mgrUsersRes = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${mgrToken}` } });
        const mgrUsers = await mgrUsersRes.json();

        const seesTeamless = mgrUsers.find(u => u.id === noTeamUser.id);
        if (seesTeamless) {
            console.error('FAILED: Manager can see teamless user!');
        } else {
            console.log('SUCCESS: Manager CANNOT see teamless user outside their team.');
        }

        const seesThemselves = mgrUsers.find(u => u.id === mgrUser.id);
        if (seesThemselves) {
            console.log('SUCCESS: Manager CAN see themselves (or their team members).');
        }

        // Cleanup
        console.log('Cleaning up...');
        await fetch(`${API_URL}/teams/${teamId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${orgAdminToken}` } });
        await fetch(`${API_URL}/users/${noTeamUser.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${orgAdminToken}` } });
        await fetch(`${API_URL}/users/${mgrUser.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${orgAdminToken}` } });
        console.log('Cleanup complete.');

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

testVisibilityAndCompat();
