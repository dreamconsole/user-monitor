import { query } from './db.js';

async function checkColumns() {
    try {
        const orgColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'organizations'
        `);
        console.log('Organizations columns:', orgColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

        const userColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Users columns:', userColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

        const sessionColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'work_sessions'
        `);
        console.log('Work Sessions columns:', sessionColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

        const activityColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'activity_logs'
        `);
        console.log('Activity Logs columns:', activityColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

        const heartbeatColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'heartbeats'
        `);
        console.log('Heartbeats columns:', heartbeatColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

        const agentSessionColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'agent_sessions'
        `);
        console.log('Agent Sessions columns:', agentSessionColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

        process.exit(0);
    } catch (error) {
        console.error('Failed to check columns:', error);
        process.exit(1);
    }
}

checkColumns();
