#!/usr/bin/env node
/**
 * Native Messaging Host for User Monitor.
 * 
 * Communicates with browser extensions via Chrome/Firefox Native Messaging protocol.
 * Protocol: Each message is prefixed with a 4-byte little-endian uint32 length.
 * 
 * This process is spawned by the browser when the extension connects.
 * It forwards messages to the Electron agent via a local HTTP endpoint.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const AGENT_PORT = 45692;
const LOG_PATH = path.join(__dirname, '..', '..', 'electron-agent', 'logs', 'native-host.log');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        fs.appendFileSync(LOG_PATH, line);
    } catch {}
}

// --- Native Messaging Protocol Helpers ---

function readNativeMessage(buffer) {
    if (buffer.length < 4) return { message: null, remaining: buffer };
    const length = buffer.readUInt32LE(0);
    if (length > 1024 * 1024) {
        log(`Message too large: ${length} bytes`);
        process.exit(1);
    }
    if (buffer.length < 4 + length) return { message: null, remaining: buffer };
    const json = buffer.slice(4, 4 + length).toString('utf-8');
    const remaining = buffer.slice(4 + length);
    try {
        return { message: JSON.parse(json), remaining };
    } catch (e) {
        log(`Parse error: ${e.message}`);
        return { message: null, remaining };
    }
}

function sendNativeMessage(msg) {
    const json = JSON.stringify(msg);
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(json.length, 0);
    process.stdout.write(buf);
    process.stdout.write(json);
}

// --- Forward to Electron Agent ---

function forwardToAgent(message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(message);
        const req = http.request({
            hostname: '127.0.0.1',
            port: AGENT_PORT,
            path: '/native-message',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 5000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve({ status: 'ok' });
                }
            });
        });

        req.on('error', (e) => {
            log(`Forward error: ${e.message}`);
            reject(e);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(data);
        req.end();
    });
}

// --- Main Loop ---

let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);

    let result;
    while ((result = readNativeMessage(inputBuffer)) && result.message) {
        inputBuffer = result.remaining;
        const msg = result.message;

        log(`Received: ${msg.type}`);

        if (msg.type === 'HEARTBEAT') {
            sendNativeMessage({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() });
        }

        forwardToAgent(msg)
            .then((response) => {
                if (response.user_id) {
                    sendNativeMessage({ type: 'CONFIG', user_id: response.user_id });
                }
            })
            .catch(() => {
                // Agent not reachable -- extension will use HTTP fallback
            });
    }
});

process.stdin.on('end', () => {
    log('stdin closed, exiting');
    process.exit(0);
});

process.on('uncaughtException', (e) => {
    log(`Uncaught: ${e.message}`);
    process.exit(1);
});

log('Native messaging host started');
