import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { getDaysInMonth, getFirstDayOfWeek, toDateStr, getMonthName, formatSeconds, formatTime } from './utils';


export default function CalendarView({
    year,
    month,
    monthData,
    selectedDate,
    setSelectedDate,
    onPrevMonth,
    onNextMonth,
    onToday,
    loading,
    today
}) {
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
                isToday: dateStr === today,
                isSelected: dateStr === selectedDate,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                key: dateStr,
            });
        }
        return cells;
    }, [year, month, monthData, selectedDate]);

    return (
        <Card>
            <CardHeader className="pb-3 space-y-3">
                <div className="w-full">
                    <Button type="button" variant="outline" className="w-full h-10 text-sm" onClick={onToday}>
                        Today
                    </Button>
                </div>
                <div className="flex items-center justify-center gap-2 w-full">
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={onPrevMonth}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <h2 className="text-xl font-semibold min-w-0 flex-1 text-center truncate px-1">
                        {getMonthName(year, month)}
                    </h2>
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={onNextMonth}>
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-1">
                        {/* Weekday headers */}
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                            <div key={d} className="text-sm font-medium text-muted-foreground text-center py-2.5">{d}</div>
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
    );
}

function CalendarCell({ cell, onClick }) {
    if (cell.empty) {
        return <div className="h-28 rounded-md" />;
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
                h-20 rounded-md border p-2 cursor-pointer transition-all text-sm
                hover:border-primary/50 hover:shadow-sm
                ${isSelected ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'border-border'}
                ${isToday && !isSelected ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : ''}
                ${isWeekend && !isSelected && !isToday ? 'bg-muted/30' : ''}
                ${!hasData ? 'opacity-60' : ''}
            `}
        >
            <div className="flex items-center justify-between mb-1">
                <span className={`font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>{day}</span>
                {hasData && data.screenshot_count > 0 && (
                    <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                )}
            </div>
            {hasData ? (
                <>
                    {/* Mini stacked bar */}
                    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden flex mb-1.5">
                        <div className="h-full bg-green-500" style={{ width: `${workPct}%` }} />
                        <div className="h-full bg-gray-400" style={{ width: `${idlePct}%` }} />
                        <div className="h-full bg-orange-500" style={{ width: `${breakPct}%` }} />
                    </div>
                </>
            ) : null}
        </div>
    );
}
