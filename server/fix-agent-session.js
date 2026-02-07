import { query } from './src/db.js';

async function fixAgentSession() {
    try {
        const res = await query(
            'UPDATE agent_sessions SET device_identifier = $1 WHERE user_id = $2 AND device_identifier IS NULL',
            ['df6e68be9f3bce4e5c73591d63c81261ef4ed1f1cc6e76b7af6a16845b6b264c', '70a3d5eb-cab5-400c-87b0-7e6dddc10a23']
        );
        console.log('Updated rows:', res.rowCount);
    } catch (e) {
        console.error('FAILED:', e);
    } finally {
        process.exit();
    }
}
fixAgentSession();
