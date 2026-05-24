import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logHeartbeat, syncActivitySession, uploadScreenshot, logActivity, logBreak, getBreaks, logBrowserActivity, getAssignedCampaigns } from '../controllers/agentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';

const router = express.Router();

import { query } from '../db.js';

// Middleware to fetch user and org names for the custom upload path
const fetchUploadMetadata = async (req, res, next) => {
    try {
        const { id, org_id } = req.user;
        const result = await query(
            'SELECT u.full_name, o.name as org_name FROM users u JOIN organizations o ON u.org_id = o.id WHERE u.id = $1 AND u.org_id = $2',
            [id, org_id]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User or Org not found for upload metadata' });
        }

        // Sanitize names for file system
        const sanitize = (name) => name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        req.uploadMetadata = {
            orgName: sanitize(result.rows[0].org_name),
            userName: sanitize(result.rows[0].full_name || 'unknown')
        };
        next();
    } catch (error) {
        console.error('Error fetching upload metadata:', error);
        res.status(500).json({ error: 'Internal server error preparing upload path' });
    }
};

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const { orgName, userName } = req.uploadMetadata || { orgName: 'unknown_org', userName: 'unknown_user' };

        const uploadDir = path.join('uploads', orgName, String(year), month, day, userName, 'screenshots');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PNG, JPEG, and WebP are allowed.'), false);
        }
    }
});

// All agent routes require authentication + valid org subscription
router.use(authenticateToken, requireActiveSubscription);

router.post('/heartbeat', logHeartbeat);
router.post('/activity-session', syncActivitySession);
router.post('/activity-log', logActivity);
router.post('/break-log', logBreak);
router.get('/breaks', getBreaks);
router.post('/screenshot', fetchUploadMetadata, upload.single('screenshot'), uploadScreenshot);
router.post('/browser-activity', logBrowserActivity);
router.get('/campaigns', getAssignedCampaigns);

export default router;
