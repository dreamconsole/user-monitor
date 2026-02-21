import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import agentRoutes from './routes/agent.js';
import orgRoutes from './routes/org.js';
import breakRoutes from './routes/breaks.js';
import statsRoutes from './routes/stats.js';
import reportRoutes from './routes/reports.js';
import exportRoutes from './routes/exports.js';
import notificationRoutes from './routes/notifications.js';
import appTrackingRoutes from './routes/appTracking.js';
import auditRoutes from './routes/audit.js';
import superadminRoutes from './routes/superadmin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware ──
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting - general
const generalLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 min
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(generalLimiter);

// Rate limiting - strict for auth endpoints
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: { error: 'Too many authentication attempts, please try again later.' }
});

// Secure uploads route - require auth to access screenshots
app.use('/uploads', authenticateToken, express.static('uploads'));

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/users', userRoutes);
app.use('/agent', agentRoutes);
app.use('/org', orgRoutes);
app.use('/breaks', breakRoutes);
app.use('/stats', statsRoutes);
app.use('/reports', reportRoutes);
app.use('/exports', exportRoutes);
app.use('/notifications', notificationRoutes);
app.use('/app-tracking', appTrackingRoutes);
app.use('/audit-logs', auditRoutes);
app.use('/superadmin', superadminRoutes);

app.get('/', (req, res) => {
    res.send({ message: 'User Monitor API' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const { query } = await import('./db.js');
        await query('SELECT 1');
        res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'error', message: 'Database connection failed' });
    }
});

// Error handling - do NOT expose internal error details to clients
app.use((err, req, res, next) => {
    const errorLog = `[${new Date().toISOString()}] ${req.method} ${req.url}\n${err.stack}\n\n`;
    fs.promises.appendFile('server-errors.log', errorLog).catch(() => { });
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Graceful shutdown
let server;
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    if (server) {
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
        setTimeout(() => { process.exit(1); }, 10000);
    } else {
        process.exit(0);
    }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    // Initialize WebSocket
    const { initWebSocket } = await import('./websocket.js');
    initWebSocket(server);

    const { startCronJobs } = await import('./cron.js');
    startCronJobs();
});
