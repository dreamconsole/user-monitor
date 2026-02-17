
// ── Helpers ──────────────────────────────────────────────────
export function formatSeconds(s) {
    if (!s || s <= 0) return '0h 0m';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatTime(iso) {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function getMonthName(y, m) {
    return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function getDaysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
}

export function getFirstDayOfWeek(y, m) {
    const d = new Date(y, m - 1, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0
}

export function toDateStr(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const PRODUCTIVITY_COLORS = {
    productive: '#22c55e',
    non_productive: '#ef4444',
    neutral: '#6366f1',
};
