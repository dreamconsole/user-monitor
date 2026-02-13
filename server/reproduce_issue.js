
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ override: true });

function log(msg) {
    fs.appendFileSync('verification_output.txt', msg + '\n');
    console.log(msg);
}

log("DATABASE_URL present: " + !!process.env.DATABASE_URL);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

log("Attempting connection...");

pool.connect()
    .then(client => {
        log("Connected successfully!");
        client.release();
    })
    .catch(err => {
        log("Connection error: " + err.message);
    })
    .finally(() => {
        pool.end();
        process.exit(0);
    });
