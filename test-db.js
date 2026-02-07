import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function test() {
    const connections = [
        'postgresql://postgres:postgres@localhost:5432/user_monitor',
        'postgresql://postgres:password@localhost:5432/user_monitor',
        'postgresql://user:postgres@localhost:5432/user_monitor',
        'postgresql://user:password@localhost:5432/user_monitor'
    ];

    for (const conn of connections) {
        console.log(`Testing: ${conn.replace(/:[^@]+@/, ':****@')}`);
        const pool = new pg.Pool({ connectionString: conn });
        try {
            const res = await pool.query('SELECT 1');
            console.log('✅ Success!');
            await pool.end();
            return;
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
        }
        await pool.end();
    }
}

test();
