import db from '../db.js';

async function up() {
    try {
        console.log('Adding org_working_hours to organizations table...');
        await db.query(`
            ALTER TABLE organizations
            ADD COLUMN IF NOT EXISTS org_working_hours NUMERIC DEFAULT 9;
        `);
        console.log('Successfully added org_working_hours column.');
        process.exit(0);
    } catch (error) {
        console.error('Error adding column:', error);
        process.exit(1);
    }
}

up();
