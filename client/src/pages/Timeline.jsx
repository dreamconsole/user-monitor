import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Coffee,
    Monitor,
    Camera,
    Timer,
    Pause,
    Activity,
    CalendarDays,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────
function formatSeconds(s) {
    if (!s || s <= 0) return '0h 0m';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso) {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getMonthName(y, m) {
    return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getDaysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
}

function getFirstDayOfWeek(y, m) {
    const d = new Date(y, m - 1, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0
}

function toDateStr(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const TODAY = new Date().toISOString().split('T')[0];

const PRODUCTIVITY_COLORS = {
    productive: '#22c55e',
    non_productive: '#ef4444',
    neutral: '#6366f1',
};

// ── Main Component ───────────────────────────────────────────
export default function Timeline() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [monthData, setMonthData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(TODAY);
    const [dayData, setDayData] = useState(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [loadingDay, setLoadingDay] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState(null);

    const isAdmin = user?.role === 'orgadmin';
    const isManager = user?.role === 'manager';
    const showPicker = isAdmin || isManager;

    // Fetch users for the picker
    useEffect(() => {
        if (!showPicker) return;
        api.get('/users').then(r => {
            setUsers(r.data || []);
            if (!selectedUserId) setSelectedUserId(user?.id);
        }).catch(() => {});
    }, [showPicker]);

    // Fetch month data
    const fetchMonth = useCallback(async () => {
        if (!selectedUserId) return;
        setLoadingMonth(true);
        try {
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            const res = await api.get('/stats/timeline', {
                params: { view: 'month', user_id: selectedUserId, month: monthStr }
            });
            setMonthData(res.data?.days || []);
        } catch (e) {
            console.error('Failed to load month data', e);
            setMonthData([]);
        } finally {
            setLoadingMonth(false);
        }
    }, [selectedUserId, year, month]);

    useEffect(() => { fetchMonth(); }, [fetchMonth]);

    // Fetch day data
    const fetchDay = useCallback(async () => {
        if (!selectedUserId || !selectedDate) return;
        setLoadingDay(true);
        try {
            const res = await api.get('/stats/timeline', {
                params: { view: 'day', user_id: selectedUserId, date: selectedDate }
            });
            setDayData(res.data);
        } catch (e) {
            console.error('Failed to load day data', e);
            setDayData(null);
        } finally {
            setLoadingDay(false);
        }
    }, [selectedUserId, selectedDate]);

    useEffect(() => { fetchDay(); }, [fetchDay]);

    // Month navigation
    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };
    const goToday = () => {
        const now = new Date();
        setYear(now.getFullYear());
        setMonth(now.getMonth() + 1);
        setSelectedDate(TODAY);
    };

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfWeek(year, month);
        const dayMap = {};
        monthData.forEach(d => {
            const key = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : d.work_date;
            dayMap[key] = d;
        });

        const cells = [];
        // Leading empty cells
        for (let i = 0; i < firstDay; i++) cells.push({ empty: true, key: `e${i}` });
        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = toDateStr(year, month, d);
            const dayOfWeek = new Date(year, month - 1, d).getDay();
            cells.push({
                empty: false,
                day: d,
                dateStr,
                data: dayMap[dateStr] || null,
                isToday: dateStr === TODAY,
                isSelected: dateStr === selectedDate,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                key: dateStr,
            });
        }
        return cells;
    }, [year, month, monthData, selectedDate]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <CalendarDays className="w-6 h-6 text-primary" />
                        Timeline
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Daily activity timeline &amp; monthly calendar view
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {showPicker && (
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.name} {u.role === 'manager' ? '(Mgr)' : u.role === 'orgadmin' ? '(Admin)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Month Navigation + Calendar */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={prevMonth}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <h2 className="text-lg font-semibold min-w-[180px] text-center">
                                {getMonthName(year, month)}
                            </h2>
                            <Button variant="outline" size="icon" onClick={nextMonth}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingMonth ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-1">
                            {/* Weekday headers */}
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                <div key={d} className="text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
                            ))}
                            {/* Day cells */}
                            {calendarDays.map(cell => (
                                <CalendarCell
                                    key={cell.key}
                                    cell={cell}
                                    onClick={() => { if (!cell.empty) setSelectedDate(cell.dateStr); }}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Daily Timeline */}
            {selectedDate && (
                <DailyTimeline
                    date={selectedDate}
                    data={dayData}
                    loading={loadingDay}
                    screenshotUrl={screenshotUrl}
                    setScreenshotUrl={setScreenshotUrl}
                />
            )}

            {/* Screenshot Modal */}
            <Dialog open={!!screenshotUrl} onOpenChange={() => setScreenshotUrl(null)}>
                <DialogContent className="max-w-4xl">
                    {screenshotUrl && (
                        <img
                            src={screenshotUrl}
                            alt="Screenshot"
                            className="w-full rounded-lg"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Calendar Cell ────────────────────────────────────────────
function CalendarCell({ cell, onClick }) {
    if (cell.empty) {
        return <div className="h-24 rounded-md" />;
    }

    const { day, data, isToday, isSelected, isWeekend } = cell;
    const hasData = !!data;
    const totalSeconds = hasData ? (data.work_seconds + data.idle_seconds + data.break_seconds) : 0;
    const workPct = totalSeconds > 0 ? (data.work_seconds / totalSeconds) * 100 : 0;
    const idlePct = totalSeconds > 0 ? (data.idle_seconds / totalSeconds) * 100 : 0;
    const breakPct = totalSeconds > 0 ? (data.break_seconds / totalSeconds) * 100 : 0;

    return (
        <div
            onClick={onClick}
            className={`
                h-24 rounded-md border p-1.5 cursor-pointer transition-all text-xs
                hover:border-primary/50 hover:shadow-sm
                ${isSelected ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-border'}
                ${isToday && !isSelected ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : ''}
                ${isWeekend && !isSelected && !isToday ? 'bg-muted/30' : ''}
                ${!hasData ? 'opacity-60' : ''}
            `}
        >
            <div className="flex items-center justify-between mb-1">
                <span className={`font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>{day}</span>
                {hasData && data.screenshot_count > 0 && (
                    <Camera className="w-3 h-3 text-muted-foreground" />
                )}
            </div>
            {hasData ? (
                <>
                    {/* Mini stacked bar */}
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex mb-1.5">
                        <div className="h-full bg-green-500" style={{ width: `${workPct}%` }} />
                        <div className="h-full bg-gray-400" style={{ width: `${idlePct}%` }} />
                        <div className="h-full bg-orange-500" style={{ width: `${breakPct}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                        <div className="font-medium text-foreground">{formatSeconds(data.work_seconds)}</div>
                        <div>{formatTime(data.first_clock_in)} - {formatTime(data.last_clock_out)}</div>
                    </div>
                </>
            ) : (
                <div className="text-[10px] text-muted-foreground mt-2">No data</div>
            )}
        </div>
    );
}

// ── Daily Timeline Panel ─────────────────────────────────────
function DailyTimeline({ date, data, loading, screenshotUrl, setScreenshotUrl }) {
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
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <div className="space-y-4">
            {/* Date title */}
            <h3 className="text-lg font-semibold">{dateLabel}</h3>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                    icon={<Timer className="w-4 h-4 text-green-600" />}
                    label="Active Work"
                    value={formatSeconds(totals.work_seconds)}
                    color="green"
                />
                <SummaryCard
                    icon={<Pause className="w-4 h-4 text-gray-500" />}
                    label="Idle Time"
                    value={formatSeconds(totals.idle_seconds)}
                    color="gray"
                />
                <SummaryCard
                    icon={<Coffee className="w-4 h-4 text-orange-500" />}
                    label="Break Time"
                    value={formatSeconds(totals.break_seconds)}
                    color="orange"
                />
                <SummaryCard
                    icon={<Clock className="w-4 h-4 text-blue-500" />}
                    label="Clock In/Out"
                    value={`${formatTime(totals.first_clock_in)} - ${formatTime(totals.last_clock_out)}`}
                    color="blue"
                />
            </div>

            {/* Horizontal Timeline */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Activity Timeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <TimelineChart
                        sessions={sessions}
                        breaks={breaks}
                        apps={apps}
                        screenshots={screenshots}
                        setScreenshotUrl={setScreenshotUrl}
                        date={date}
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
                        <AppUsageTable apps={apps} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ── Summary Card ─────────────────────────────────────────────
function SummaryCard({ icon, label, value, color }) {
    const borderColors = {
        green: 'border-l-green-500',
        gray: 'border-l-gray-400',
        orange: 'border-l-orange-500',
        blue: 'border-l-blue-500',
    };
    return (
        <Card className={`border-l-4 ${borderColors[color] || ''}`}>
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="text-sm font-semibold">{value}</div>
            </CardContent>
        </Card>
    );
}

// ── Horizontal Timeline Chart ────────────────────────────────
function TimelineChart({ sessions, breaks, apps, screenshots, setScreenshotUrl, date }) {
    // Determine day range (default 08:00 - 20:00, expand based on data)
    let minHour = 8, maxHour = 20;

    const allTimes = [
        ...sessions.flatMap(s => [s.start_time, s.end_time]),
        ...breaks.flatMap(b => [b.start_time, b.end_time]),
        ...apps.flatMap(a => [a.start_time, a.end_time]),
        ...screenshots.map(s => s.captured_at),
    ].filter(Boolean);

    allTimes.forEach(t => {
        const h = new Date(t).getHours();
        if (h < minHour) minHour = Math.max(0, h - 1);
        if (h >= maxHour) maxHour = Math.min(24, h + 2);
    });

    const totalHours = maxHour - minHour;
    if (totalHours <= 0) {
        return <div className="text-sm text-muted-foreground py-4 text-center">No activity recorded for this day</div>;
    }

    const dayStart = new Date(`${date}T${String(minHour).padStart(2, '0')}:00:00`);
    const dayEnd = new Date(`${date}T${String(maxHour).padStart(2, '0')}:00:00`);
    const totalMs = dayEnd - dayStart;

    function pct(time) {
        if (!time) return 0;
        const t = new Date(time);
        return Math.max(0, Math.min(100, ((t - dayStart) / totalMs) * 100));
    }

    function widthPct(start, end) {
        if (!start || !end) return 0;
        return Math.max(0.3, pct(end) - pct(start));
    }

    // Hour grid lines
    const hourLines = [];
    for (let h = minHour; h <= maxHour; h++) {
        hourLines.push(h);
    }

    // Current time line
    const now = new Date();
    const nowDate = now.toISOString().split('T')[0];
    const showNowLine = nowDate === date && now >= dayStart && now <= dayEnd;
    const nowPct = showNowLine ? ((now - dayStart) / totalMs) * 100 : -1;

    return (
        <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="relative h-6 mb-1">
                {hourLines.map(h => (
                    <div
                        key={h}
                        className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                        style={{ left: `${((h - minHour) / totalHours) * 100}%` }}
                    >
                        {String(h).padStart(2, '0')}:00
                    </div>
                ))}
            </div>

            {/* Lane: Work Sessions */}
            <TimelineLane label="Work" minHour={minHour} maxHour={maxHour} totalHours={totalHours} nowPct={nowPct}>
                {sessions.map((s, i) => (
                    <TimelineBlock
                        key={i}
                        left={pct(s.start_time)}
                        width={widthPct(s.start_time, s.end_time)}
                        color="#22c55e"
                        tooltip={`Work: ${formatTime(s.start_time)} - ${formatTime(s.end_time)} (${formatSeconds(s.work_seconds)})`}
                    />
                ))}
            </TimelineLane>

            {/* Lane: Breaks */}
            <TimelineLane label="Breaks" minHour={minHour} maxHour={maxHour} totalHours={totalHours} nowPct={nowPct}>
                {breaks.map((b, i) => (
                    <TimelineBlock
                        key={i}
                        left={pct(b.start_time)}
                        width={widthPct(b.start_time, b.end_time)}
                        color="#f97316"
                        tooltip={`${b.break_name}: ${formatTime(b.start_time)} - ${formatTime(b.end_time)} (${formatSeconds(b.duration_seconds)})`}
                        label={b.break_name}
                    />
                ))}
            </TimelineLane>

            {/* Lane: Apps */}
            <TimelineLane label="Apps" minHour={minHour} maxHour={maxHour} totalHours={totalHours} nowPct={nowPct}>
                {apps.map((a, i) => (
                    <TimelineBlock
                        key={i}
                        left={pct(a.start_time)}
                        width={widthPct(a.start_time, a.end_time)}
                        color={PRODUCTIVITY_COLORS[a.productivity_type] || '#6366f1'}
                        tooltip={`${a.app_name}: ${formatTime(a.start_time)} - ${formatTime(a.end_time)} (${formatSeconds(a.duration_seconds)})`}
                        label={a.app_name}
                    />
                ))}
            </TimelineLane>

            {/* Lane: Screenshots */}
            <TimelineLane label="Screens" minHour={minHour} maxHour={maxHour} totalHours={totalHours} nowPct={nowPct}>
                {screenshots.map((s, i) => (
                    <div
                        key={i}
                        className="absolute top-1 cursor-pointer hover:scale-125 transition-transform z-10"
                        style={{ left: `${pct(s.captured_at)}%` }}
                        title={`Screenshot at ${formatTime(s.captured_at)}`}
                        onClick={() => {
                            const baseUrl = api.defaults.baseURL || 'http://localhost:3000';
                            setScreenshotUrl(`${baseUrl}/${s.storage_path}`);
                        }}
                    >
                        <Camera className="w-4 h-4 text-violet-600" />
                    </div>
                ))}
            </TimelineLane>
        </div>
    );
}

// ── Timeline Lane ────────────────────────────────────────────
function TimelineLane({ label, minHour, maxHour, totalHours, nowPct, children }) {
    const hourLines = [];
    for (let h = minHour; h <= maxHour; h++) hourLines.push(h);

    return (
        <div className="flex items-stretch mb-1">
            <div className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground flex items-center pr-2 justify-end">
                {label}
            </div>
            <div className="flex-1 relative h-7 bg-muted/40 rounded-sm border border-border/50 overflow-hidden">
                {/* Hour grid */}
                {hourLines.map(h => (
                    <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/30"
                        style={{ left: `${((h - minHour) / totalHours) * 100}%` }}
                    />
                ))}
                {/* Current time */}
                {nowPct >= 0 && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: `${nowPct}%` }}
                    />
                )}
                {/* Content */}
                {children}
            </div>
        </div>
    );
}

// ── Timeline Block ───────────────────────────────────────────
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

// ── Intensity Bar ────────────────────────────────────────────
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
                            title={`${bucket.time} - Keys: ${bucket.keyboard}, Mouse: ${bucket.mouse}`}
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

// ── App Usage Table ──────────────────────────────────────────
function AppUsageTable({ apps }) {
    // Aggregate by app name
    const appMap = {};
    apps.forEach(a => {
        const key = a.app_name || a.executable_name || 'Unknown';
        if (!appMap[key]) {
            appMap[key] = {
                app_name: key,
                productivity_type: a.productivity_type,
                category_name: a.category_name,
                total_seconds: 0,
            };
        }
        appMap[key].total_seconds += a.duration_seconds;
    });

    const sorted = Object.values(appMap).sort((a, b) => b.total_seconds - a.total_seconds);
    const grandTotal = sorted.reduce((s, a) => s + a.total_seconds, 0) || 1;

    const badgeVariant = (type) => {
        if (type === 'productive') return 'default';
        if (type === 'non_productive') return 'destructive';
        return 'secondary';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 font-medium">Application</th>
                        <th className="py-2 font-medium">Category</th>
                        <th className="py-2 font-medium">Type</th>
                        <th className="py-2 font-medium text-right">Duration</th>
                        <th className="py-2 font-medium text-right">%</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((app, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 font-medium">{app.app_name}</td>
                            <td className="py-2 text-muted-foreground">{app.category_name || '--'}</td>
                            <td className="py-2">
                                <Badge variant={badgeVariant(app.productivity_type)} className="text-[10px]">
                                    {(app.productivity_type || 'neutral').replace('_', '-')}
                                </Badge>
                            </td>
                            <td className="py-2 text-right">{formatSeconds(app.total_seconds)}</td>
                            <td className="py-2 text-right">{((app.total_seconds / grandTotal) * 100).toFixed(1)}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
