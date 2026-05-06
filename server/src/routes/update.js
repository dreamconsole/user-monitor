import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { fetchAgentUpdateManifest } from '../controllers/agentUpdateInfoController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/** Keys / patterns whose values must never appear in JSON responses */
function redactEnv(env) {
    const out = {};
    const sensitiveKey = (key) => {
        const k = key.toUpperCase();
        if (/SECRET|PASSWORD|PRIVATE_KEY|API_KEY|JWT|TOKEN|AUTH|CREDENTIAL|COOKIE|SESSION|BEARER/i.test(key)) return true;
        if (/DATABASE_URL|^DB_|_URI$|CONNECTION_STRING|DSN$/i.test(key)) return true;
        return false;
    };
    for (const [key, value] of Object.entries(env)) {
        if (value == null || value === '') {
            out[key] = value;
            continue;
        }
        out[key] = sensitiveKey(key) ? '[redacted]' : value;
    }
    return out;
}

router.get('/', async (req, res) => {
    const serverRoot = path.join(__dirname, '..', '..');
    const packageJsonPath = path.join(serverRoot, 'package.json');

    let pkg = { version: 'unknown', name: 'server' };
    try {
        const raw = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        pkg = { name: raw.name, version: raw.version, description: raw.description };
    } catch (e) {
        pkg.readError = e.message;
    }

    const dotEnvPath = path.join(serverRoot, '.env');
    const uploadsDir = path.join(serverRoot, 'uploads');
    const entryScript = path.join(__dirname, '..', 'index.js');
    const electronAgentPkgPath = path.join(serverRoot, '..', 'electron-agent', 'package.json');

    let electronAgent = null;
    try {
        if (fs.existsSync(electronAgentPkgPath)) {
            const epkg = JSON.parse(fs.readFileSync(electronAgentPkgPath, 'utf8'));
            electronAgent = {
                name: epkg.name,
                version: epkg.version,
                packageJsonPath: electronAgentPkgPath
            };
        }
    } catch (e) {
        electronAgent = { error: e.message };
    }

    let agentUpdate;
    try {
        agentUpdate = await fetchAgentUpdateManifest();
    } catch (e) {
        agentUpdate = {
            configured: false,
            latestVersion: null,
            downloadUrl: null,
            downloadUrlMsi: null,
            releaseNotes: null,
            configurationHint: 'Could not load global_settings.'
        };
    }

    res.json({
        ok: true,
        endpoint: '/update',
        version: pkg.version,
        package: {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            readError: pkg.readError
        },
        details: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            uptimeSeconds: Math.floor(process.uptime()),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date().toISOString()
        },
        env: redactEnv(process.env),
        paths: {
            serverRoot,
            packageJson: packageJsonPath,
            dotEnv: dotEnvPath,
            dotEnvExists: fs.existsSync(dotEnvPath),
            entryScript,
            routesDir: __dirname,
            cwd: process.cwd(),
            uploadsDir,
            uploadsDirExists: fs.existsSync(uploadsDir)
        },
        electronAgent,
        /** Same as `GET /agent/update-info` (global_settings + optional legacy env). */
        agentUpdate
    });
});

export default router;
