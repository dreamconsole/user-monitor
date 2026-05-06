import { query } from '../db.js';

/** Keys in `global_settings` for desktop agent updates */
const GS = {
    version: 'agent_latest_version',
    winUrl: 'agent_windows_download_url',
    msiUrl: 'agent_windows_download_url_msi',
    notes: 'agent_update_release_notes'
};

function coerceString(val) {
    if (val == null || val === '') return '';
    if (typeof val === 'string') return val.trim();
    return String(val).trim();
}

/**
 * Reads manifest from `global_settings`, then falls back to legacy env vars if unset.
 */
export async function fetchAgentUpdateManifest() {
    let latestVersion = '';
    let downloadUrl = '';
    let downloadUrlMsi = '';
    let releaseNotes = '';

    try {
        const keys = [GS.version, GS.winUrl, GS.msiUrl, GS.notes];
        const result = await query(
            `SELECT setting_key, setting_value FROM global_settings WHERE setting_key = ANY($1::text[])`,
            [keys]
        );
        const map = {};
        for (const row of result.rows) {
            map[row.setting_key] = row.setting_value;
        }
        latestVersion = coerceString(map[GS.version]);
        downloadUrl = coerceString(map[GS.winUrl]);
        downloadUrlMsi = coerceString(map[GS.msiUrl]);
        releaseNotes = coerceString(map[GS.notes]);
    } catch (e) {
        console.error('[agentUpdate] failed to read global_settings:', e.message);
    }

    // Legacy env fallback (optional)
    if (!latestVersion) latestVersion = (process.env.AGENT_UPDATE_LATEST_VERSION || '').trim();
    if (!downloadUrl) downloadUrl = (process.env.AGENT_UPDATE_DOWNLOAD_URL || '').trim();
    if (!downloadUrlMsi) downloadUrlMsi = (process.env.AGENT_UPDATE_DOWNLOAD_URL_MSI || '').trim();
    if (!releaseNotes) releaseNotes = (process.env.AGENT_UPDATE_RELEASE_NOTES || '').trim();

    const configured = Boolean(latestVersion && downloadUrl);

    let configurationHint = null;
    if (!configured) {
        const missing = [];
        if (!latestVersion) missing.push('agent_latest_version');
        if (!downloadUrl) missing.push('agent_windows_download_url');
        configurationHint =
            missing.length > 0
                ? `Set ${missing.join(' and ')} in Super Admin → Global Settings, or use legacy AGENT_UPDATE_* env vars.`
                : null;
    }

    return {
        configured,
        latestVersion: configured ? latestVersion : null,
        downloadUrl: configured ? downloadUrl : null,
        downloadUrlMsi: downloadUrlMsi || null,
        releaseNotes: releaseNotes || null,
        configurationHint
    };
}

/**
 * Public manifest for desktop agent update checks (no auth).
 */
export async function getAgentUpdateInfo(req, res) {
    try {
        const m = await fetchAgentUpdateManifest();
        res.json({
            success: true,
            ...m
        });
    } catch (err) {
        console.error('[agentUpdate] getAgentUpdateInfo:', err);
        res.status(500).json({
            success: false,
            error: 'Could not load agent update settings',
            configured: false,
            latestVersion: null,
            downloadUrl: null,
            downloadUrlMsi: null,
            releaseNotes: null,
            configurationHint: 'Server error reading global settings.'
        });
    }
}
