
// ── Helpers ──────────────────────────────────────────────────
export function formatSeconds(s) {
    if (!s || s <= 0) return '0h 0m';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Day summary totals. When org uses auto pause (breaks off), gap between clock in/out and
 * tracked work+idle+break is shown as pause/break time (client-side only).
 */
export function computeDayTimeTotals(totals, isAutoBreakPolicy) {
    const workSeconds = totals?.work_seconds || 0;
    const idleSeconds = totals?.idle_seconds || 0;
    const loggedBreakSeconds = totals?.break_seconds || 0;

    let clockSpanSeconds = 0;
    if (totals?.first_clock_in && totals?.last_clock_out) {
        const end = new Date(totals.last_clock_out).getTime();
        const start = new Date(totals.first_clock_in).getTime();
        if (end > start) clockSpanSeconds = Math.floor((end - start) / 1000);
    }

    let pauseBreakSeconds = 0;
    if (isAutoBreakPolicy && clockSpanSeconds > 0) {
        pauseBreakSeconds = Math.max(
            0,
            clockSpanSeconds - workSeconds - idleSeconds - loggedBreakSeconds
        );
    }

    const breakSeconds = isAutoBreakPolicy
        ? loggedBreakSeconds + pauseBreakSeconds
        : loggedBreakSeconds;

    const availableSeconds = workSeconds + idleSeconds + breakSeconds;

    return {
        workSeconds,
        idleSeconds,
        breakSeconds,
        availableSeconds,
        pauseBreakSeconds,
        clockSpanSeconds,
        isAutoBreakPolicy,
    };
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
