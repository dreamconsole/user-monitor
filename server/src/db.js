import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

// Override parsing of DATE fields (OID 1082) to keep them as 'YYYY-MM-DD' strings 
// instead of letting node-pg convert them to local Date objects which shift timezones.
pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('Unexpected pool error:', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
