import { formatInTimeZone } from 'date-fns-tz';

/**
 * Converts an instant to a calendar string in the given IANA timezone (wall clock).
 */
export const utcToLocal = (timestamp, timezone, formatStr = 'yyyy-MM-dd HH:mm:ss') => {
    if (!timestamp) return '---';
    return formatInTimeZone(new Date(timestamp), timezone || 'UTC', formatStr);
};

/**
 * Gets the localized calendar date (YYYY-MM-DD) for an instant in the given timezone.
 */
export const getWorkDate = (timestamp, timezone) => {
    if (!timestamp) return null;
    return formatInTimeZone(new Date(timestamp), timezone || 'UTC', 'yyyy-MM-dd');
};

/**
 * Seconds since local midnight for this instant in the given timezone (for timeline positioning).
 */
export const getSecondsSinceMidnightInTz = (timestamp, timezone) => {
    if (!timestamp) return 0;
    const tz = timezone || 'UTC';
    const wall = formatInTimeZone(new Date(timestamp), tz, 'HH:mm:ss');
    const [h, m, s] = wall.split(':').map(Number);
    return h * 3600 + m * 60 + (Number.isFinite(s) ? s : 0);
};

/** Calendar "today" as YYYY-MM-DD in the given IANA timezone (client clock). */
export const getTodayInTimezone = (timezone) => getWorkDate(new Date(), timezone);

/**
 * Returns the browser's current IANA timezone.
 * @returns {string}
 */
export const getBrowserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
};
