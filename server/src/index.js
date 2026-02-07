import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import agentRoutes from './routes/agent.js';
import orgRoutes from './routes/org.js';
import breakRoutes from './routes/breaks.js';
import statsRoutes from './routes/stats.js';
import reportRoutes from './routes/reports.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/agent', agentRoutes);
app.use('/org', orgRoutes);
app.use('/breaks', breakRoutes);
app.use('/stats', statsRoutes);
app.use('/reports', reportRoutes);

app.get('/', (req, res) => {
    res.send({ message: 'User Monitor API' });
});

app.get('/env-check', (req, res) => {
    res.json({ hasJwtSecret: !!process.env.JWT_SECRET });
});

// Error handling
app.use((err, req, res, next) => {
    const errorLog = `[${new Date().toISOString()}] ${req.method} ${req.url}\n${err.stack}\n\n`;
    fs.appendFileSync('server-errors.log', errorLog);
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// Pair Extraordinaire badge attempt
