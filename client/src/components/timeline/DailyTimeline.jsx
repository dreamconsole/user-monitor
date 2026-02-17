import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Timer, Pause, Coffee, Clock, Activity, Monitor, Camera } from 'lucide-react';
import { formatSeconds, formatTime, PRODUCTIVITY_COLORS } from './utils';
import api from '@/lib/api';
import AppUsageList from './AppUsageList';
import SessionLogTable from './SessionLogTable';

export default function DailyTimeline({ date, data, loading, screenshotUrl, setScreenshotUrl }) {
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
                        <div className="max-h-[300px] overflow-y-auto pr-2">
                            <AppUsageList apps={apps} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Session & Break Log Table */}
            <div className="mt-4">
                <SessionLogTable sessions={sessions} breaks={breaks} />
            </div>
        </div>
    );
}

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

function TimelineChart({ sessions, breaks, apps, screenshots, setScreenshotUrl, date }) {
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

    const hourLines = [];
    for (let h = minHour; h <= maxHour; h++) {
        hourLines.push(h);
    }

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

function TimelineLane({ label, minHour, maxHour, totalHours, nowPct, children }) {
    const hourLines = [];
    for (let h = minHour; h <= maxHour; h++) hourLines.push(h);

    return (
        <div className="flex items-stretch mb-1">
            <div className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground flex items-center pr-2 justify-end">
                {label}
            </div>
            <div className="flex-1 relative h-7 bg-muted/40 rounded-sm border border-border/50 overflow-hidden">
                {hourLines.map(h => (
                    <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/30"
                        style={{ left: `${((h - minHour) / totalHours) * 100}%` }}
                    />
                ))}
                {nowPct >= 0 && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
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
