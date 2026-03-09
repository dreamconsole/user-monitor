import { utcToLocal } from './client/src/lib/dateUtils.js';

// Testing fallback behavior if org_timezone isn't passed (e.g. legacy JWTs)
const dt = '2026-03-09T18:00:00Z';
console.log('Using fallback timezone (user): ', utcToLocal(dt, 'Asia/Thimphu'));
console.log('Using Org Timezone (passed): ', utcToLocal(dt, 'America/Los_Angeles'));
