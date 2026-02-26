import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3000';

async function testTeamLogic() {
    console.log('--- TEAM LOGIC TEST ---');
    try {
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@acme.com', password: 'password123' })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        const { token, user } = loginData;

        // Create a Team
        console.log('Creating a Team...');
        const teamRes = await fetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: 'Automated Test Team', description: 'Testing 2-manager limit' })
        });
        const teamData = await teamRes.json();
        if (!teamRes.ok) throw new Error(`Team creation failed: ${JSON.stringify(teamData)}`);
        const teamId = teamData.id;
        console.log(`Team created with ID: ${teamId}`);

        // Create 3 Managers
        const managerIds = [];
        for (let i = 1; i <= 3; i++) {
            console.log(`Creating Manager ${i}...`);
            const mgrRes = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    name: `Test Manager ${i}`,
                    email: `testmgr${i}_${Date.now()}@acme.com`,
                    password: 'password123',
                    role: 'manager',
                    emp_id: `MGR-${i}-${Date.now()}`,
                    timezone: 'UTC'
                })
            });
            const mgrData = await mgrRes.json();
            if (!mgrRes.ok) throw new Error(`Manager ${i} creation failed: ${JSON.stringify(mgrData)}`);
            managerIds.push(mgrData.id);
        }

        // Add first 2 managers
        console.log('Adding 2 managers to the team...');
        const add2Res = await fetch(`${API_URL}/teams/${teamId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userIds: [managerIds[0], managerIds[1]] })
        });
        if (!add2Res.ok) throw new Error(`Failed to add 2 managers: ${JSON.stringify(await add2Res.json())}`);
        console.log('Successfully added 2 managers (Expected).');

        // Try adding 3rd manager
        console.log('Attempting to add 3rd manager...');
        const add3Res = await fetch(`${API_URL}/teams/${teamId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userIds: [managerIds[2]] })
        });
        if (add3Res.ok) {
            console.error('FAILED: Was able to add 3rd manager!');
        } else {
            const errData = await add3Res.json();
            console.log(`SUCCESS: Prevented 3rd manager. Error: ${errData.error}`);
        }

        // Cleanup
        console.log('Cleaning up...');
        await fetch(`${API_URL}/teams/${teamId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        for (const id of managerIds) {
            await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        }
        console.log('Cleanup complete. Tests finished.');
    } catch (e) {
        console.error('Test Failed:', e.message);
    }
}

testTeamLogic();
