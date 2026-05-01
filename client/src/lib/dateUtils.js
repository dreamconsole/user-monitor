import { format, toZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC timestamp (string, Date, or number) to a localized string in the given timezone.
 * @param {string|Date|number} timestamp 
 * @param {string} timezone IANA timezone string (e.g., 'Asia/Kolkata')
 * @param {string} formatStr date-fns format string
 * @returns {string}
 */
export const utcToLocal = (timestamp, timezone, formatStr = 'yyyy-MM-dd HH:mm:ss') => {
    if (!timestamp) return '---';
    const date = new Date(timestamp);
    const zonedDate = toZonedTime(date, timezone || 'UTC');
    return format(zonedDate, formatStr, { timeZone: timezone || 'UTC' });
};

/**
 * Gets the localized "work date" for a timestamp based on the user's timezone.
 * Useful for grouping activities into shifts.
 * @param {string|Date|number} timestamp 
 * @param {string} timezone 
 * @returns {string} YYYY-MM-DD
 */
export const getWorkDate = (timestamp, timezone) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const zonedDate = toZonedTime(date, timezone || 'UTC');
    return format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone || 'UTC' });
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
