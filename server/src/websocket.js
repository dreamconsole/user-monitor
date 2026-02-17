import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

let wss = null;
const clients = new Map(); // userId -> Set of ws connections

export function initWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        // Authenticate via query param token
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');

        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }

        try {
            const user = jwt.verify(token, process.env.JWT_SECRET);
            ws.userId = user.id;
            ws.orgId = user.org_id;
            ws.userRole = user.role;

            // Track connection
            if (!clients.has(user.id)) {
                clients.set(user.id, new Set());
            }
            clients.get(user.id).add(ws);

            ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));

            ws.on('close', () => {
                const userConns = clients.get(user.id);
                if (userConns) {
                    userConns.delete(ws);
                    if (userConns.size === 0) {
                        clients.delete(user.id);
                    }
                }
            });

            ws.on('error', () => {
                ws.close();
            });

            // Heartbeat to keep connection alive
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });
        } catch (err) {
            ws.close(4003, 'Invalid token');
        }
    });

    // Ping interval to detect dead connections
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    console.log('WebSocket server initialized on /ws');
    return wss;
}

/**
 * Broadcast a message to all connected clients in an org.
 */
export function broadcastToOrg(orgId, data) {
    if (!wss) return;

    const message = JSON.stringify(data);
    wss.clients.forEach((ws) => {
        if (ws.orgId === orgId && ws.readyState === 1) {
            ws.send(message);
        }
    });
}

/**
 * Send a message to a specific user.
 */
export function sendToUser(userId, data) {
    const userConns = clients.get(userId);
    if (!userConns) return;

    const message = JSON.stringify(data);
    userConns.forEach((ws) => {
        if (ws.readyState === 1) {
            ws.send(message);
        }
    });
}

/**
 * Broadcast to all managers/admins in an org (for notifications).
 */
export function broadcastToManagers(orgId, data) {
    if (!wss) return;

    const message = JSON.stringify(data);
    wss.clients.forEach((ws) => {
        if (ws.orgId === orgId && (ws.userRole === 'orgadmin' || ws.userRole === 'manager') && ws.readyState === 1) {
            ws.send(message);
        }
    });
}
