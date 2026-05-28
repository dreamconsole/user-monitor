import { query, getClient } from '../db.js';
import { createManualSubscription } from '../services/subscriptionService.js';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
const execAsync = promisify(exec);

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFolderSizeBytes(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        try {
            if (entry.isDirectory()) {
                total += getFolderSizeBytes(full);
            } else if (entry.isFile()) {
                total += fs.statSync(full).size;
            }
        } catch {
            /* skip inaccessible files */
        }
    }
    return total;
}

async function getDiskInfoCrossPlatform() {
    if (process.platform === 'win32') {
        try {
            const { stdout } = await execAsync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:list');
            const sizeMatch = stdout.match(/Size=(\d+)/);
            const freeMatch = stdout.match(/FreeSpace=(\d+)/);
            if (sizeMatch && freeMatch) {
                const total = parseInt(sizeMatch[1], 10);
                const free = parseInt(freeMatch[1], 10);
                const used = total - free;
                const percent = total > 0 ? `${Math.round((used / total) * 100)}%` : 'N/A';
                return {
                    total: formatBytes(total),
                    used: formatBytes(used),
                    free: formatBytes(free),
                    percent,
                };
            }
        } catch {
            /* fall through */
        }
        return { total: 'N/A', used: 'N/A', free: 'N/A', percent: 'N/A' };
    }
    try {
        const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'");
        const [total, used, free, percent] = stdout.trim().split(/\s+/);
        return { total, used, free, percent };
    } catch {
        return { total: 'N/A', used: 'N/A', free: 'N/A', percent: 'N/A' };
    }
}

// Get all organizations with some additional stats
export const createOrg = async (req, res) => {
    const {
        name, domain, max_users_limit, timezone, adminName, adminEmail, adminPassword,
        subscription_required, plan_id, licensed_seats,
    } = req.body;

    if (!name || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: 'Org Name, Admin Name, Email and Password are required' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 1. Create Org
        const seats = licensed_seats ?? max_users_limit ?? 10;
        const subRequired = subscription_required !== false;

        const orgResult = await client.query(
            `INSERT INTO organizations (name, domain, max_users_limit, timezone, subscription_required)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, domain || null, seats, timezone || 'UTC', subRequired]
        );
        const org = orgResult.rows[0];

        await client.query('INSERT INTO org_features (org_id) VALUES ($1)', [org.id]);

        await createManualSubscription(client, org.id, {
            planId: plan_id || 'starter',
            licensedSeats: seats,
            status: 'active',
            periodMonths: 12,
        });

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await client.query(
            `INSERT INTO users (org_id, full_name, email, password_hash, role, timezone, is_active)
             VALUES ($1, $2, $3, $4, 'orgadmin', $5, true)`,
            [org.id, adminName, adminEmail.toLowerCase().trim(), hashedPassword, timezone || 'UTC']
        );

        await client.query('COMMIT');
        res.status(201).json(org);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('createOrg error:', error);
        res.status(500).json({ error: 'Failed to create organization' });
    } finally {
        client.release();
    }
};

export const getOrgs = async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                o.id, 
                o.name, 
                o.domain, 
                o.max_users_limit, 
                o.is_active,
                COALESCE(o.subscription_required, true) as subscription_required,
                o.created_at,
                (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) as current_users,
                (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id AND u.role = 'user' AND u.is_active = true
                    AND (u.deleted_at IS NULL)) as seats_used,
                COALESCE(of.is_campaigns_enabled, false) as is_campaigns_enabled,
                s.plan_id,
                s.status as subscription_status,
                s.licensed_seats,
                s.current_period_end,
                s.trial_ends_at,
                s.provider
            FROM organizations o
            LEFT JOIN org_features of ON of.org_id = o.id
            LEFT JOIN subscriptions s ON s.org_id = o.id
            ORDER BY o.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('getOrgs error:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
};

// Update an organization (subscription limit, active status etc)
export const updateOrg = async (req, res) => {
    const { id } = req.params;
    const { max_users_limit, is_active, is_campaigns_enabled, subscription_required, name, domain, timezone } = req.body;

    try {
        const result = await query(`
            UPDATE organizations 
            SET max_users_limit = COALESCE($1, max_users_limit),
                is_active = COALESCE($2, is_active),
                subscription_required = COALESCE($3, subscription_required),
                name = COALESCE($4, name),
                domain = COALESCE($5, domain),
                timezone = COALESCE($6, timezone),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING id, name, max_users_limit, is_active, subscription_required
        `, [max_users_limit, is_active, subscription_required, name, domain, timezone, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Update org_features if is_campaigns_enabled is provided
        if (is_campaigns_enabled !== undefined) {
            await query(`
                INSERT INTO org_features (org_id, is_campaigns_enabled)
                VALUES ($1, $2)
                ON CONFLICT (org_id) DO UPDATE SET is_campaigns_enabled = $2
            `, [id, is_campaigns_enabled]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('updateOrg error:', error);
        res.status(500).json({ error: 'Failed to update organization' });
    }
};

// Delete an organization - Soft Delete recommended
export const deleteOrg = async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete by setting is_active = false initially.
        // If a hard delete is required, it must cascade properly to users, sessions, etc.
        const result = await query(`
            UPDATE organizations 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING id
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Org not found' });
        res.json({ message: 'Organization deactivated successfully' });
    } catch (error) {
        console.error('deleteOrg error:', error);
        res.status(500).json({ error: 'Failed to deactivate organization' });
    }
};

// Get all global settings
export const getSettings = async (req, res) => {
    try {
        const result = await query('SELECT setting_key, setting_value, description FROM global_settings ORDER BY setting_key ASC');
        // Convert to key-value map for frontend
        const settingsMap = {};
        for (const row of result.rows) {
            settingsMap[row.setting_key] = {
                value: row.setting_value,
                description: row.description
            };
        }
        res.json(settingsMap);
    } catch (error) {
        console.error('getSettings error:', error);
        res.status(500).json({ error: 'Failed to fetch global settings' });
    }
};

// Update a specific global setting
export const updateSettings = async (req, res) => {
    const { settings } = req.body; // Expecting an array [{ key: 'sso_google_enabled', value: true }]

    if (!Array.isArray(settings)) {
        return res.status(400).json({ error: 'Request body must contain a "settings" array.' });
    }

    try {
        await query('BEGIN');

        for (const setting of settings) {
            if (!setting.key || setting.value === undefined) continue;

            await query(`
                INSERT INTO global_settings (setting_key, setting_value) 
                VALUES ($1, $2::jsonb)
                ON CONFLICT (setting_key) 
                DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
            `, [setting.key, JSON.stringify(setting.value)]);
        }

        await query('COMMIT');
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        await query('ROLLBACK');
        console.error('updateSettings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

// Get Database Stats
export const getDBStats = async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                relname AS table_name, 
                pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                pg_total_relation_size(relid) AS size_bytes
            FROM pg_catalog.pg_statio_user_tables 
            ORDER BY pg_total_relation_size(relid) DESC
        `);

        const uploadsDir = path.resolve('uploads');
        const uploadSize = formatBytes(getFolderSizeBytes(uploadsDir));

        res.json({
            tables: stats.rows,
            uploads_folder_size: uploadSize
        });
    } catch (error) {
        console.error('getDBStats error:', error);
        res.status(500).json({ error: 'Failed to fetch database stats' });
    }
};

// Cleanup old data
export const cleanupData = async (req, res) => {
    const { days } = req.body;
    if (!days || isNaN(days)) return res.status(400).json({ error: 'Invalid retention days' });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    const cutoffStr = cutoffDate.toISOString();

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 1. Get screenshot paths to delete files
        const screenshotResult = await client.query(
            'SELECT storage_path FROM screenshots WHERE captured_at < $1',
            [cutoffStr]
        );

        // 2. Delete from DB
        const deletedScreenshots = await client.query('DELETE FROM screenshots WHERE captured_at < $1', [cutoffStr]);
        const deletedActivity = await client.query('DELETE FROM activity_logs WHERE log_time < $1', [cutoffStr]);
        const deletedBrowser = await client.query('DELETE FROM browser_activities WHERE start_time < $1', [cutoffStr]);

        await client.query('COMMIT');

        // 3. Delete physical files
        let filesDeleted = 0;
        for (const row of screenshotResult.rows) {
            if (row.storage_path) {
                const fullPath = path.resolve(row.storage_path);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    filesDeleted++;
                }
            }
        }

        res.json({
            message: `Cleanup successful for data older than ${days} days`,
            summary: {
                screenshots_removed: deletedScreenshots.rowCount,
                activity_logs_removed: deletedActivity.rowCount,
                browser_logs_removed: deletedBrowser.rowCount,
                files_deleted_from_disk: filesDeleted
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('cleanupData error:', error);
        res.status(500).json({ error: 'Failed to perform cleanup' });
    } finally {
        client.release();
    }
};

// Get System Health (high level aggregations)
export const getSystemHealth = async (req, res) => {
    try {
        const orgsCount = await query('SELECT COUNT(*) FROM organizations');
        const activeUsers = await query("SELECT COUNT(*) FROM users WHERE is_active = true");
        const activeAgents = await query("SELECT COUNT(*) FROM agent_sessions WHERE token_expires_at > CURRENT_TIMESTAMP");

        // System Stats
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const cpuCores = os.cpus().length;
        const cpuModel = os.cpus()[0].model;
        const loadAvg = os.loadavg();

        const diskInfo = await getDiskInfoCrossPlatform();

        res.json({
            uptime: process.uptime(),
            total_orgs: parseInt(orgsCount.rows[0].count),
            active_users: parseInt(activeUsers.rows[0].count),
            active_agent_sessions: parseInt(activeAgents.rows[0].count),
            system: {
                memory: {
                    total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                    used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                    free: (freeMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                    percent: ((usedMem / totalMem) * 100).toFixed(1) + '%'
                },
                cpu: {
                    cores: cpuCores,
                    model: cpuModel,
                    load: loadAvg[0].toFixed(2)
                },
                disk: diskInfo
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('getSystemHealth error:', error);
        res.status(500).json({ error: 'Failed to get system health metrics' });
    }
};
