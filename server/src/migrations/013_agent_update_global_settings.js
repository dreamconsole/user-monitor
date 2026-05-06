import { getClient } from '../db.js';

/**
 * Desktop agent update URLs + notes in global_settings (Super Admin UI).
 * Uses keys: agent_latest_version (existing), agent_windows_download_url, optional MSI + release notes.
 */
async function migrate() {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query(`
            INSERT INTO global_settings (setting_key, setting_value, description)
            VALUES
              ('agent_windows_download_url', to_jsonb(''::text),
               'HTTPS URL to the Windows NSIS installer (.exe). Required with Agent latest version for update checks.'),
              ('agent_windows_download_url_msi', to_jsonb(''::text),
               'Optional HTTPS URL to the MSI installer for IT deployments.'),
              ('agent_update_release_notes', to_jsonb(''::text),
               'Optional short release notes for the desktop agent update.')
            ON CONFLICT (setting_key) DO NOTHING
        `);

        await client.query(`
            UPDATE global_settings
            SET description = 'Latest published agent semver (e.g. 1.2.1). Together with Windows installer URL enables GET /agent/update-info.'
            WHERE setting_key = 'agent_latest_version'
        `);

        await client.query('COMMIT');
        console.log('Migration 013_agent_update_global_settings completed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration 013_agent_update_global_settings failed:', e);
        throw e;
    } finally {
        client.release();
    }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
