import schedule from 'node-schedule';
import { query } from './db.js';
import { checkAndNotifyBreakViolation } from './controllers/agentController.js';

// We need to export/import checkAndNotifyBreakViolation or replicate logic. 
// Since agentController is an ES module, we can import it if we export it.
// I need to ensure agentController.js exports checkAndNotifyBreakViolation.

export const startCronJobs = () => {
    console.log('Starting Cron Jobs...');

    // Run every 2 minutes
    schedule.scheduleJob('*/2 * * * *', async () => {
        try {
            // Find currently active breaks that MIGHT be violating limits
            // or just find ALL active breaks and check them.
            const activeBreaks = await query(
                `SELECT user_id, break_type_id 
                 FROM break_logs 
                 WHERE end_time IS NULL 
                 AND start_time::DATE = CURRENT_DATE`
            );

            for (const row of activeBreaks.rows) {
                // Determine if this specific break + previous breaks exceeds limit
                // We reuse the robust logic in checkAndNotifyBreakViolation
                await checkAndNotifyBreakViolation(null, row.user_id, row.break_type_id)
                    .catch(err => console.error(`Cron check failed for User ${row.user_id}:`, err));
            }
        } catch (err) {
            console.error('Cron Job Error:', err);
        }
    });
};
