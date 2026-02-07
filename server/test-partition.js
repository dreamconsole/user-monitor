import { query } from './src/db.js';

async function testInsert() {
    try {
        const res = await query(
            'INSERT INTO activity_logs (org_id, user_id, session_id, log_time, state) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            ['e09b0fb1-d87a-48cf-9ea5-873e1e79e37d', '70a3d5eb-cab5-400c-87b0-7e6dddc10a23', '4bad2bc7-49d7-4aca-a0a2-219f84d1ac34', new Date().toISOString(), 'active']
        );
        console.log('Inserted:', res.rows[0].id);
    } catch (e) {
        console.error('FAILED:', e);
    } finally {
        process.exit();
    }
}
testInsert();
