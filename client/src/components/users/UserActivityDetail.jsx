import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { utcToLocal } from '@/lib/dateUtils';
import api from '@/lib/api';
import CalendarView from '@/components/timeline/CalendarView';
import DailyTimeline from '@/components/timeline/DailyTimeline';

const TODAY = new Date().toISOString().split('T')[0];

export default function UserActivityDetail({ user, onClose }) {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [selectedDate, setSelectedDate] = useState(TODAY);

    const [monthData, setMonthData] = useState([]);
    const [dayData, setDayData] = useState(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [loadingDay, setLoadingDay] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState(null);

    // Fetch Month Data
    const fetchMonth = useCallback(async () => {
        if (!user?.id) return;
        setLoadingMonth(true);
        try {
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            const res = await api.get('/stats/timeline', {
                params: { view: 'month', user_id: user.id, month: monthStr }
            });
            setMonthData(res.data?.days || []);
        } catch (e) {
            console.error('Failed to load month data', e);
            setMonthData([]);
        } finally {
            setLoadingMonth(false);
        }
    }, [user?.id, year, month]);

    useEffect(() => { fetchMonth(); }, [fetchMonth]);

    // Fetch Day Data
    const fetchDay = useCallback(async () => {
        if (!user?.id || !selectedDate) return;
        setLoadingDay(true);
        try {
            const res = await api.get('/stats/timeline', {
                params: { view: 'day', user_id: user.id, date: selectedDate }
            });
            setDayData(res.data);
        } catch (e) {
            console.error('Failed to load day data', e);
            setDayData(null);
        } finally {
            setLoadingDay(false);
        }
    }, [user?.id, selectedDate]);

    useEffect(() => { fetchDay(); }, [fetchDay]);

    // Navigation handlers
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

    const prevDay = () => setSelectedDate(d => {
        const date = new Date(d);
        date.setDate(date.getDate() - 1);
        // Also update calendar view month if needed
        if (date.getMonth() + 1 !== month) {
            setMonth(date.getMonth() + 1);
            setYear(date.getFullYear());
        }
        return date.toISOString().split('T')[0];
    });

    const nextDay = () => setSelectedDate(d => {
        const date = new Date(d);
        date.setDate(date.getDate() + 1);
        // Also update calendar view month if needed
        if (date.getMonth() + 1 !== month) {
            setMonth(date.getMonth() + 1);
            setYear(date.getFullYear());
        }
        return date.toISOString().split('T')[0];
    });

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="border-b p-4 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-lg font-semibold">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevDay}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-2 font-medium min-w-[140px] justify-center text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextDay} disabled={selectedDate === TODAY}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-border mx-2" />

                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                    {/* Left Column: Calendar (4 cols) - Sticky */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="lg:sticky lg:top-0">
                            <CalendarView
                                year={year}
                                month={month}
                                monthData={monthData}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                onPrevMonth={prevMonth}
                                onNextMonth={nextMonth}
                                onToday={goToday}
                                loading={loadingMonth}
                            />
                        </div>
                    </div>

                    {/* Right Column: Daily Details (8 cols) */}
                    <div className="lg:col-span-8 space-y-6 pb-10">
                        <DailyTimeline
                            date={selectedDate}
                            data={dayData}
                            loading={loadingDay}
                            screenshotUrl={screenshotUrl}
                            setScreenshotUrl={setScreenshotUrl}
                        />
                    </div>
                </div>
            </div>

            {/* Screenshot Modal (reused here if needed props passed down, or better to move modal up) */}
            {/* Note: DailyTimeline handles the click but we need to render the dialog somewhere if not inside DailyTimeline 
                The current DailyTimeline component DOES not include the Dialog, it only updates the state. 
                We need to render the Dialog here or modify DailyTimeline. 
                Wait, looking at DailyTimeline.jsx, it DOES NOT render the Dialog. 
                Timeline.jsx rendered the Dialog. 
                So I should render the Dialog here too.
            */}
            {/* Screenshot Modal */}
            {screenshotUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setScreenshotUrl(null)}>
                    <div className="relative max-w-5xl w-full p-4" onClick={e => e.stopPropagation()}>
                        <button className="absolute -top-10 right-0 text-white" onClick={() => setScreenshotUrl(null)}>
                            <X className="w-8 h-8" />
                        </button>
                        <img
                            src={screenshotUrl}
                            alt="Screenshot"
                            className="w-full rounded-lg"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
