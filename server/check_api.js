import { query } from './src/db.js';

async function test() {
    // mock the exact query
    let sql = `
            SELECT 
                u.id, u.full_name as name, u.email, u.role, u.is_active, 
                u.team_id, t.name as team_name, u.timezone, u.emp_id, u.payroll_id, u.site, 
                u.device_id, u.agent_version, u.token, u.last_heartbeat, 
                u.force_logout, u.created_at,
                u.shift_start_time, u.shift_end_time, u.shift_duration, u.work_days, u.start_of_day,
                EXISTS(SELECT 1 FROM break_logs bl WHERE bl.user_id = u.id AND bl.end_time IS NULL) as is_on_break
            FROM users u 
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.full_name = 'Admin User'
        `;
    const res = await query(sql);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
test();
