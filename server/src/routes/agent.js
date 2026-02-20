import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logHeartbeat, syncActivitySession, uploadScreenshot, logActivity, logBreak, getBreaks, logBrowserActivity } from '../controllers/agentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/screenshots';
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

// All agent routes require authentication
router.use(authenticateToken);

router.post('/heartbeat', logHeartbeat);
router.post('/activity-session', syncActivitySession);
router.post('/activity-log', logActivity);
router.post('/break-log', logBreak);
router.get('/breaks', getBreaks);
router.post('/screenshot', upload.single('screenshot'), uploadScreenshot);
router.post('/browser-activity', logBrowserActivity);

export default router;
