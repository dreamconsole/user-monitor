import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import UserSearchSelect from '@/components/UserSearchSelect';
import { CalendarDays } from 'lucide-react';
import CalendarView from '@/components/timeline/CalendarView';
import DailyTimeline from '@/components/timeline/DailyTimeline';
import { getTodayInTimezone } from '@/lib/dateUtils';

export default function Timeline() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [monthData, setMonthData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => getTodayInTimezone('UTC'));
    const [dayData, setDayData] = useState(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [loadingDay, setLoadingDay] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState(null);

    const isAdmin = user?.role === 'orgadmin';
    const isManager = user?.role === 'manager';
    const showPicker = isAdmin || isManager;

    useEffect(() => {
        if (!user) return;
        const t = user.org_timezone || user.timezone || 'UTC';
        const d = getTodayInTimezone(t);
        setSelectedDate(d);
        const [y, mo] = d.split('-');
        setYear(Number(y));
        setMonth(Number(mo));
    }, [user?.org_timezone, user?.timezone]);

    // Fetch users for the picker
    useEffect(() => {
        if (!showPicker) return;
        api.get('/users').then(r => {
            setUsers(r.data || []);
            if (!selectedUserId) setSelectedUserId(user?.id);
        }).catch(() => { });
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
        const t = user?.org_timezone || user?.timezone || 'UTC';
        const d = getTodayInTimezone(t);
        const [y, mo] = d.split('-');
        setYear(Number(y));
        setMonth(Number(mo));
        setSelectedDate(d);
    };

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
                        <UserSearchSelect
                            users={users}
                            value={selectedUserId}
                            onChange={setSelectedUserId}
                            placeholder="Select user..."
                            className="w-[250px]"
                        />
                    )}
                </div>
            </div>

            {/* Month Navigation + Calendar */}
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
