import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Timer, Pause, Coffee, Clock, Activity, Monitor, Camera, MousePointerClick, MousePointer2, Moon, Mouse, ZoomIn, ZoomOut } from 'lucide-react';
import { formatSeconds, PRODUCTIVITY_COLORS, computeDayTimeTotals } from './utils';
import { utcToLocal, getWorkDate, getSecondsSinceMidnightInTz } from '@/lib/dateUtils';
import api from '@/lib/api';
import AppUsageList from './AppUsageList';
import SessionLogTable from './SessionLogTable';

/** Max zoom (500%) — enough px/minute to place many screenshots; minute grid turns on earlier. */
const ZOOM_MAX = 5;
/** At or above this zoom, show every screenshot for the day (no per-hour sampling). */
const ZOOM_SHOW_ALL_SCREENSHOTS = 3.25;

/** Screenshot markers are laid out in this many horizontal bands to avoid collapse when many captures exist. */
const SHOT_TRACK_ROWS = 3;
const SHOT_ROW_HEIGHT_PX = 24;

/** Zoom level used as “Fit” default — paired with {@link SCREENSHOTS_PER_HOUR_AT_FIT}. */
const TIMELINE_FIT_ZOOM = 1.35;
/** At Fit zoom, show about this many screenshot markers per clock hour (minimal clutter). */
const SCREENSHOTS_PER_HOUR_AT_FIT = 3;

/** Evenly spread picks across a sorted list (by time). */
function sampleScreenshotsEvenly(sorted, k) {
    if (k <= 0 || !sorted.length) return [];
    if (sorted.length <= k) return sorted.slice();
    if (k === 1) return [sorted[Math.floor((sorted.length - 1) / 2)]];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < k; i++) {
        const idx = Math.round((i * (sorted.length - 1)) / (k - 1));
        const s = sorted[idx];
        const key = s.id || `${s.captured_at}-${s.storage_path}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push(s);
        }
    }
    // Fill if duplicates shrunk the count (rare)
    if (out.length < k) {
        for (const s of sorted) {
            const key = s.id || `${s.captured_at}-${s.storage_path}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push(s);
                if (out.length >= k) break;
            }
        }
    }
    return out;
}

/**
 * Per local hour, cap visible screenshot markers. At Fit zoom ≈ SCREENSHOTS_PER_HOUR_AT_FIT per hour; zooming in raises the cap (same icon size, more markers).
 */
function selectScreenshotsForDensity(screenshots, date, tz, minHour, maxHour, zoom) {
    if (!screenshots?.length) return [];
    const dayShots = screenshots.filter((s) => getWorkDate(s.captured_at, tz) === date);
    if (dayShots.length === 0) return [];

    if (zoom >= ZOOM_SHOW_ALL_SCREENSHOTS) {
        return dayShots.slice().sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
    }

    let perHour = Math.round(SCREENSHOTS_PER_HOUR_AT_FIT * (zoom / TIMELINE_FIT_ZOOM));
    perHour = Math.max(1, Math.min(200, perHour));

    const byHour = new Map();
    for (const s of dayShots) {
        const h = Math.floor(getSecondsSinceMidnightInTz(s.captured_at, tz) / 3600);
        if (h < minHour || h > maxHour) continue;
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h).push(s);
    }

    const chosen = [];
    for (const [, list] of [...byHour.entries()].sort((a, b) => a[0] - b[0])) {
        list.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
        chosen.push(...sampleScreenshotsEvenly(list, perHour));
    }
    chosen.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
    return chosen;
}

export default function DailyTimeline({ date, data, loading, screenshotUrl, setScreenshotUrl, user }) {
    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-48 pt-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </CardContent>
            </Card>
        );
    }
    if (!data) return null;

    const { sessions, breaks, apps, screenshots, activity, totals } = data;
    const isAutoBreakPolicy = user?.features?.is_breaks_enabled === false;
    const dayTotals = computeDayTimeTotals(totals, isAutoBreakPolicy);
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const formatTimeLocal = (iso) => utcToLocal(iso, user.org_timezone || user.timezone, 'HH:mm');

    return (
        <div className="space-y-4">
            {/* Date title */}
            <h3 className="text-lg font-semibold">{dateLabel}</h3>

            {/* Summary Cards Row 1: Time */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                <SummaryCard
                    icon={<Monitor className="w-4 h-4 text-indigo-600" />}
                    label="Available for the day"
                    value={formatSeconds(dayTotals.availableSeconds)}
                    color="indigo"
                    subtitle={isAutoBreakPolicy && dayTotals.clockSpanSeconds > 0 ? 'Clock in → out span' : undefined}
                />
                <SummaryCard
                    icon={<Timer className="w-4 h-4 text-green-600" />}
                    label="Work Session"
                    value={formatSeconds(dayTotals.workSeconds)}
                    color="green"
                />

                <SummaryCard
                    icon={<Coffee className="w-4 h-4 text-orange-500" />}
                    label={isAutoBreakPolicy ? 'Break / pause' : 'Break Time'}
                    value={formatSeconds(dayTotals.breakSeconds)}
                    color="orange"
                    subtitle={
                        isAutoBreakPolicy && dayTotals.pauseBreakSeconds > 0
                            ? `${formatSeconds(dayTotals.pauseBreakSeconds)} auto pause`
                            : undefined
                    }
                />
                <SummaryCard
                    icon={<Clock className="w-4 h-4 text-blue-500" />}
                    label="Clock In/Out"
                    value={`${formatTimeLocal(totals.first_clock_in)} - ${formatTimeLocal(totals.last_clock_out)}`}
                    color="blue"
                />
            </div>

            {/* Summary Cards Row 2: Mouse & AFK */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                    icon={<MousePointerClick className="w-4 h-4 text-blue-500" />}
                    label="Left Clicks"
                    value={(totals.total_left_clicks ?? 0).toLocaleString()}
                    color="blue"
                    subtitle="Touchpad + Mouse"
                />
                <SummaryCard
                    icon={<MousePointer2 className="w-4 h-4 text-purple-500" />}
                    label="Right Clicks"
                    value={(totals.total_right_clicks ?? 0).toLocaleString()}
                    color="purple"
                    subtitle="Touchpad + Mouse"
                />
                <SummaryCard
                    icon={<Mouse className="w-4 h-4 text-indigo-500" />}
                    label="Mouse Events"
                    value={(
                        (totals.total_left_clicks ?? 0) +
                        (totals.total_right_clicks ?? 0)
                    ).toLocaleString()}
                    color="indigo"
                    subtitle="All clicks combined"
                />
                <SummaryCard
                    icon={<Moon className="w-4 h-4 text-amber-500" />}
                    label="AFK Time"
                    value={`${totals.afk_minutes ?? Math.floor((totals.idle_seconds ?? 0) / 60)} min`}
                    color="amber"
                    subtitle="Away from keyboard"
                />
            </div>

            {/* Horizontal Timeline */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Activity Timeline
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Scroll horizontally. At <strong className="font-medium text-foreground">Fit</strong> zoom, about {SCREENSHOTS_PER_HOUR_AT_FIT} screenshot markers per hour; zoom in to show more (same icon size).
                    </p>
                </CardHeader>
                <CardContent className="overflow-x-auto overflow-y-visible pb-2 scroll-smooth">
                    <TimelineChart
                        sessions={sessions}
                        breaks={breaks}
                        apps={apps}
                        screenshots={screenshots}
                        setScreenshotUrl={setScreenshotUrl}
                        date={date}
                        user={user}
                        formatTimeLocal={formatTimeLocal}
                    />
                </CardContent>
            </Card>

            {/* Activity Intensity */}
            {activity && activity.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Input Activity Intensity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <IntensityBar data={activity} />
                    </CardContent>
                </Card>
            )}

            {/* App Usage Table */}
            {apps && apps.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            Application Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[300px] overflow-y-auto pr-2">
                            <AppUsageList apps={apps} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Session & Break Log Table */}
            <div className="mt-4">
                <SessionLogTable sessions={sessions} breaks={breaks} formatTimeLocal={formatTimeLocal} />
            </div>
        </div>
    );
}

function SummaryCard({ icon, label, value, color, subtitle }) {
    const borderColors = {
        green: 'border-l-green-500',
        gray: 'border-l-gray-400',
        orange: 'border-l-orange-500',
        blue: 'border-l-blue-500',
        purple: 'border-l-purple-500',
        indigo: 'border-l-indigo-500',
        amber: 'border-l-amber-500',
    };
    return (
        <Card className={`border-l-4 ${borderColors[color] || ''}`}>
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="text-sm font-semibold">{value}</div>
                {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
            </CardContent>
        </Card>
    );
}

/** Quarter-hour vertical guides when zoomed in (`left` % matches Work/Breaks/Shots). */
function MinuteGridLines({ minHour, maxHour, totalSeconds, zoom }) {
    if (zoom < 1.55 || totalSeconds <= 0) return null;
    const els = [];
    for (let h = minHour; h <= maxHour; h++) {
        for (const m of [15, 30, 45]) {
            const rel = h * 3600 + m * 60 - minHour * 3600;
            if (rel <= 0 || rel >= totalSeconds) continue;
            els.push(
                <div
                    key={`mg-${h}-${m}`}
                    className="absolute top-0 bottom-0 border-l border-dashed pointer-events-none z-0 border-border/20"
                    style={{ left: `${(rel / totalSeconds) * 100}%` }}
                />
            );
        }
    }
    return <>{els}</>;
}

/** Horizontal fan-out index when screenshot markers would overlap (same row, small px offset). */
function computeScreenshotStacks(screenshots, pctFn, collisionPct) {
    if (!screenshots?.length) return [];
    const indices = screenshots.map((_, i) => i).sort(
        (a, b) => pctFn(screenshots[a].captured_at) - pctFn(screenshots[b].captured_at)
    );
    const stack = new Array(screenshots.length).fill(0);
    for (let k = 0; k < indices.length; k++) {
        const i = indices[k];
        const pi = pctFn(screenshots[i].captured_at);
        let maxBelow = -1;
        for (let j = 0; j < k; j++) {
            const pj = pctFn(screenshots[indices[j]].captured_at);
            if (Math.abs(pi - pj) < collisionPct) {
                maxBelow = Math.max(maxBelow, stack[indices[j]]);
            }
        }
        stack[i] = maxBelow + 1;
    }
    return stack;
}

/** Computes visible hour range (no hooks — safe to early-return). */
function TimelineChart({ sessions, breaks, apps, screenshots, setScreenshotUrl, date, user, formatTimeLocal }) {
    const tz = user?.org_timezone || user?.timezone || 'UTC';
    let minHour = 8, maxHour = 20;

    const allTimes = [
        ...sessions.flatMap(s => [s.start_time, s.end_time]),
        ...breaks.flatMap(b => [b.start_time, b.end_time]),
        ...apps.flatMap(a => [a.start_time, a.end_time]),
        ...(screenshots || []).map(s => s.captured_at),
    ].filter(Boolean);

    allTimes.forEach(t => {
        const timeStr = utcToLocal(t, tz, 'HH:mm');
        const h = parseInt(timeStr.split(':')[0], 10);
        if (h < minHour) minHour = Math.max(0, h - 1);
        if (h >= maxHour) maxHour = Math.min(24, h + 2);
    });

    const totalHours = maxHour - minHour;
    if (totalHours <= 0) {
        return <div className="text-sm text-muted-foreground py-4 text-center">No activity recorded for this day</div>;
    }

    return (
        <TimelineChartInteractive
            sessions={sessions}
            breaks={breaks}
            apps={apps}
            screenshots={screenshots}
            setScreenshotUrl={setScreenshotUrl}
            date={date}
            user={user}
            formatTimeLocal={formatTimeLocal}
            minHour={minHour}
            maxHour={maxHour}
            totalHours={totalHours}
        />
    );
}

function TimelineChartInteractive({
    sessions,
    breaks,
    apps,
    screenshots,
    setScreenshotUrl,
    date,
    user,
    formatTimeLocal,
    minHour,
    maxHour,
    totalHours,
}) {
    const [zoom, setZoom] = useState(TIMELINE_FIT_ZOOM);
    const tz = user?.org_timezone || user?.timezone || 'UTC';
    const totalSeconds = totalHours * 3600;

    function pct(time) {
        if (!time) return 0;
        const workDate = getWorkDate(time, tz);
        let sec;
        if (workDate < date) sec = 0;
        else if (workDate > date) sec = 24 * 3600;
        else sec = getSecondsSinceMidnightInTz(time, tz);

        return Math.max(0, Math.min(100, ((sec - minHour * 3600) / totalSeconds) * 100));
    }

    function widthPct(start, end) {
        if (!start || !end) return 0;
        return Math.max(0.3, pct(end) - pct(start));
    }

    const hourLines = [];
    for (let h = minHour; h <= maxHour; h++) {
        hourLines.push(h);
    }

    const nowIso = new Date().toISOString();
    const nowDateStr = getWorkDate(nowIso, tz);
    const showNowLine = nowDateStr === date;
    const nowPct = showNowLine ? pct(nowIso) : -1;

    const chartMinWidthPx = Math.round(760 * zoom);
    const collisionPct = useMemo(
        () => Math.max(0.12, (22 / chartMinWidthPx) * 100),
        [chartMinWidthPx]
    );

    const screenshotsSameDay = useMemo(
        () => (screenshots || []).filter((s) => getWorkDate(s.captured_at, tz) === date),
        [screenshots, date, tz]
    );

    const visibleScreenshots = useMemo(
        () =>
            selectScreenshotsForDensity(screenshots || [], date, tz, minHour, maxHour, zoom),
        [screenshots, date, tz, minHour, maxHour, zoom]
    );

    /** Round-robin into {@link SHOT_TRACK_ROWS} rows by time order; fan overlaps per row only. */
    const shotsRowsAndFans = useMemo(() => {
        const sorted = visibleScreenshots
            .slice()
            .sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
        const rows = [[], [], []];
        sorted.forEach((s, i) => {
            rows[i % SHOT_TRACK_ROWS].push(s);
        });
        const fans = rows.map((row) => computeScreenshotStacks(row, pct, collisionPct));
        return { rows, fans };
    }, [visibleScreenshots, collisionPct, minHour, maxHour, totalSeconds, date, tz]);

    const zoomOut = () => setZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
    const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, Math.round((z + 0.25) * 100) / 100));

    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-3">
                <span className="text-xs text-muted-foreground max-w-xl">
                    One scroll for the chart. Fit ≈ {SCREENSHOTS_PER_HOUR_AT_FIT} shots/hour; ≥{Math.round(ZOOM_SHOW_ALL_SCREENSHOTS * 100)}% zoom shows every capture; quarter-hour grid when zoomed.
                    {screenshotsSameDay.length > 0 && (
                        <span className="text-muted-foreground/90">
                            {' '}
                            Showing <strong className="text-foreground font-medium">{visibleScreenshots.length}</strong> of{' '}
                            <strong className="text-foreground font-medium">{screenshotsSameDay.length}</strong> today.
                        </span>
                    )}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden sm:inline">Zoom</span>
                        <input
                            type="range"
                            min={50}
                            max={500}
                            step={5}
                            value={Math.round(zoom * 100)}
                            onChange={(e) => setZoom(Number(e.target.value) / 100)}
                            className="w-full sm:w-44 h-2 accent-primary cursor-pointer"
                            aria-label="Timeline zoom"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={zoomOut} disabled={zoom <= 0.5} title="Zoom out">
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-xs tabular-nums min-w-[3rem] text-center text-muted-foreground font-medium">{Math.round(zoom * 100)}%</span>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="Zoom in">
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setZoom(TIMELINE_FIT_ZOOM)} title="Default zoom (~3 screenshots per hour)">
                            Fit
                        </Button>
                    </div>
                </div>
            </div>

            <div className="min-w-0" style={{ minWidth: `${chartMinWidthPx}px` }}>
                {/* Hour + minute labels — same flex-1 track width as lanes (`min-w-0` avoids misaligned %) */}
                <div className="flex mb-1">
                    <div className="w-14 shrink-0 pr-2" aria-hidden="true" />
                    <div className="flex-1 relative min-w-0 h-10">
                        <MinuteGridLines minHour={minHour} maxHour={maxHour} totalSeconds={totalSeconds} zoom={zoom} />
                        {hourLines.map(h => (
                            <div
                                key={h}
                                className="absolute text-[10px] text-muted-foreground -translate-x-1/2 select-none top-0"
                                style={{ left: `${((h - minHour) / totalHours) * 100}%` }}
                            >
                                {String(h).padStart(2, '0')}:00
                            </div>
                        ))}
                        {zoom >= 3 &&
                            (() => {
                                const labels = [];
                                for (let h = minHour; h <= maxHour; h++) {
                                    for (const m of [15, 30, 45]) {
                                        const rel = h * 3600 + m * 60 - minHour * 3600;
                                        if (rel <= 0 || rel >= totalSeconds) continue;
                                        labels.push(
                                            <div
                                                key={`hdr-${h}-${m}`}
                                                className="absolute text-[9px] tabular-nums text-muted-foreground/90 -translate-x-1/2 select-none bottom-0 leading-none whitespace-nowrap"
                                                style={{ left: `${(rel / totalSeconds) * 100}%` }}
                                            >
                                                {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                                            </div>
                                        );
                                    }
                                }
                                return labels;
                            })()}
                    </div>
                </div>

                {/* Lane: Work Sessions */}
                <TimelineLane label="Work" minHour={minHour} maxHour={maxHour} totalHours={totalHours} totalSeconds={totalSeconds} zoom={zoom} nowPct={nowPct}>
                    {sessions.map((s, i) => (
                        <TimelineBlock
                            key={i}
                            left={pct(s.start_time)}
                            width={widthPct(s.start_time, s.end_time)}
                            color="#22c55e"
                            tooltip={`Work: ${formatTimeLocal(s.start_time)} - ${formatTimeLocal(s.end_time)} (${formatSeconds(s.work_seconds)})`}
                        />
                    ))}
                </TimelineLane>

                {/* Lane: Breaks */}
                <TimelineLane label="Breaks" minHour={minHour} maxHour={maxHour} totalHours={totalHours} totalSeconds={totalSeconds} zoom={zoom} nowPct={nowPct}>
                    {breaks.map((b, i) => (
                        <TimelineBlock
                            key={i}
                            left={pct(b.start_time)}
                            width={widthPct(b.start_time, b.end_time)}
                            color="#f97316"
                            tooltip={`${b.break_name}: ${formatTimeLocal(b.start_time)} - ${formatTimeLocal(b.end_time)} (${formatSeconds(b.duration_seconds)})`}
                            label={b.break_name}
                        />
                    ))}
                </TimelineLane>

                {/* Lane: Apps */}
                <TimelineLane label="Apps" minHour={minHour} maxHour={maxHour} totalHours={totalHours} totalSeconds={totalSeconds} zoom={zoom} nowPct={nowPct}>
                    {apps.map((a, i) => (
                        <TimelineBlock
                            key={i}
                            left={pct(a.start_time)}
                            width={widthPct(a.start_time, a.end_time)}
                            color={PRODUCTIVITY_COLORS[a.productivity_type] || '#6366f1'}
                            tooltip={`${a.app_name}: ${formatTimeLocal(a.start_time)} - ${formatTimeLocal(a.end_time)} (${formatSeconds(a.duration_seconds)})`}
                            label={a.app_name}
                        />
                    ))}
                </TimelineLane>

                {/* Screenshots: three horizontal bands (same time axis); fan within each row only */}
                <div className="flex items-stretch mb-0 overflow-visible">
                    <div className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground pr-2 justify-end flex items-start pt-1 leading-tight">
                        Shots
                    </div>
                    <div
                        className="flex-1 relative min-w-0 rounded-sm border border-violet-500/25 bg-violet-500/[0.06] overflow-visible"
                        style={{
                            height: `${8 + SHOT_TRACK_ROWS * SHOT_ROW_HEIGHT_PX + 8}px`,
                        }}
                    >
                        <MinuteGridLines minHour={minHour} maxHour={maxHour} totalSeconds={totalSeconds} zoom={zoom} />
                        {hourLines.map(h => (
                            <div
                                key={`shot-${h}`}
                                className="absolute top-0 bottom-0 border-l border-violet-500/15 pointer-events-none z-[1]"
                                style={{ left: `${((h - minHour) / totalHours) * 100}%` }}
                            />
                        ))}
                        {nowPct >= 0 && (
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500/90 z-20 pointer-events-none"
                                style={{ left: `${nowPct}%` }}
                            />
                        )}
                        {screenshotsSameDay.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                No screenshots this day
                            </div>
                        )}
                        {shotsRowsAndFans.rows.map((rowShots, rowIdx) =>
                            rowShots.map((s, j) => {
                                const fan = (shotsRowsAndFans.fans[rowIdx][j] ?? 0) * 12;
                                const topPx = 6 + rowIdx * SHOT_ROW_HEIGHT_PX;
                                return (
                                    <button
                                        key={s.id || `${s.captured_at}-r${rowIdx}-${j}`}
                                        type="button"
                                        className="absolute z-10 cursor-pointer rounded-full border border-violet-500/40 bg-background p-1 shadow-sm hover:bg-violet-500/10 hover:border-violet-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        style={{
                                            left: `${pct(s.captured_at)}%`,
                                            top: `${topPx}px`,
                                            transform: `translateX(calc(-50% + ${fan}px))`,
                                        }}
                                        title={`Open screenshot — ${formatTimeLocal(s.captured_at)}`}
                                        onClick={() => {
                                            const baseUrl = api.defaults.baseURL || 'http://localhost:3000';
                                            setScreenshotUrl(`${baseUrl}/${s.storage_path}`);
                                        }}
                                    >
                                        <Camera className="w-3.5 h-3.5 text-violet-600" />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TimelineLane({ label, minHour, maxHour, totalHours, totalSeconds, zoom, nowPct, children }) {
    const hourLines = [];
    for (let h = minHour; h <= maxHour; h++) hourLines.push(h);

    return (
        <div className="flex items-stretch mb-1">
            <div className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground pr-2 justify-end flex items-center">
                {label}
            </div>
            <div className="flex-1 relative min-w-0 h-7 bg-muted/40 rounded-sm border border-border/50 overflow-hidden">
                <MinuteGridLines minHour={minHour} maxHour={maxHour} totalSeconds={totalSeconds} zoom={zoom} />
                {hourLines.map(h => (
                    <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/30 pointer-events-none"
                        style={{ left: `${((h - minHour) / totalHours) * 100}%` }}
                    />
                ))}
                {nowPct >= 0 && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                        style={{ left: `${nowPct}%` }}
                    />
                )}
                {children}
            </div>
        </div>
    );
}

function TimelineBlock({ left, width, color, tooltip, label }) {
    return (
        <div
            className="absolute top-1 bottom-1 rounded-sm flex items-center overflow-hidden group cursor-default"
            style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: color,
                minWidth: '2px',
            }}
            title={tooltip}
        >
            {width > 5 && label && (
                <span className="text-[9px] text-white px-1 truncate font-medium drop-shadow-sm">
                    {label}
                </span>
            )}
        </div>
    );
}

function ProductivityChart({ apps }) {
    if (!apps || apps.length === 0) {
        return <div className="text-sm text-muted-foreground flex h-[150px] items-center justify-center">No app usage data</div>;
    }

    const data = [
        { name: 'Productive', value: 0, color: PRODUCTIVITY_COLORS.productive },
        { name: 'Non-Productive', value: 0, color: PRODUCTIVITY_COLORS.non_productive },
        { name: 'Neutral', value: 0, color: PRODUCTIVITY_COLORS.neutral },
    ];

    apps.forEach(app => {
        const type = app.productivity_type || 'neutral';
        const item = data.find(d => d.name.toLowerCase().replace('-', '_') === type) || data[2];
        // fallback to neutral if mismatch, though keys should match 'productive', 'non_productive', 'neutral'
        // Actually PRODUCTIVITY_COLORS keys are 'productive', 'non_productive', 'neutral'.
        // My data names are Title Case. 
        // Let's match by index or simple logic
        if (type === 'productive') data[0].value += app.duration_seconds;
        else if (type === 'non_productive') data[1].value += app.duration_seconds;
        else data[2].value += app.duration_seconds;
    });

    const activeData = data.filter(d => d.value > 0);

    return (
        <div className="h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={activeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {activeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <RechartsTooltip
                        formatter={(value) => formatSeconds(value)}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

function IntensityBar({ data }) {
    if (!data || data.length === 0) return null;
    const maxEvents = Math.max(...data.map(d => d.keyboard + d.mouse), 1);

    return (
        <div>
            <div className="flex gap-px">
                {data.map((bucket, i) => {
                    const intensity = (bucket.keyboard + bucket.mouse) / maxEvents;
                    const alpha = Math.max(0.1, intensity);
                    return (
                        <div
                            key={i}
                            className="flex-1 h-6 rounded-sm cursor-default"
                            style={{ backgroundColor: `rgba(34, 197, 94, ${alpha})` }}
                            title={`${bucket.time} — Keys: ${bucket.keyboard}, Mouse: ${bucket.mouse}, Left: ${bucket.left_clicks ?? 0}, Right: ${bucket.right_clicks ?? 0}`}
                        />
                    );
                })}
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{data[0]?.time || ''}</span>
                <span className="text-[10px] text-muted-foreground">
                    Low <span className="inline-block w-3 h-2 rounded-sm mx-0.5" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }} />
                    <span className="inline-block w-3 h-2 rounded-sm mx-0.5" style={{ backgroundColor: 'rgba(34,197,94,0.4)' }} />
                    <span className="inline-block w-3 h-2 rounded-sm mx-0.5" style={{ backgroundColor: 'rgba(34,197,94,0.7)' }} />
                    <span className="inline-block w-3 h-2 rounded-sm mx-0.5" style={{ backgroundColor: 'rgba(34,197,94,1)' }} /> High
                </span>
                <span className="text-[10px] text-muted-foreground">{data[data.length - 1]?.time || ''}</span>
            </div>
        </div>
    );
}
