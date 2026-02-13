import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Monitor, Coffee, AlertCircle, ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { utcToLocal } from '@/lib/dateUtils';
import api from '@/lib/api';

const ActivityBar = ({ active, idle, hour }) => {
    const total = active + idle;
    if (total === 0) return (
        <div className="flex flex-col items-center gap-1 group">
            <div className="h-24 w-4 bg-muted/20 rounded-sm relative" title={`Hour ${hour}: No Activity`}></div>
            <span className="text-[10px] text-muted-foreground">{hour}</span>
        </div>
    );

    const activeHeight = (active / 3600) * 100; // % of hour
    const idleHeight = (idle / 3600) * 100;

    return (
        <div className="flex flex-col items-center gap-1 group">
            <div className="h-24 w-4 bg-muted/30 rounded-sm relative flex flex-col-reverse overflow-hidden" title={`Hour ${hour}: ${(active / 60).toFixed(0)}m Active, ${(idle / 60).toFixed(0)}m Idle`}>
                <div style={{ height: `${activeHeight}%` }} className="bg-green-500 w-full transition-all group-hover:bg-green-600" />
                <div style={{ height: `${idleHeight}%` }} className="bg-orange-300 w-full transition-all group-hover:bg-orange-400" />
            </div>
            <span className="text-[10px] text-muted-foreground">{hour}</span>
        </div>
    );
};

export default function UserActivityDetail({ user, onClose }) {
    const [stats, setStats] = useState(null); // { hourly: [], totals: {}, logs: [] }
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const { data } = await api.get(`/stats/user/${user.id}/hourly?date=${dateStr}`);
                setStats(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user.id, selectedDate]);

    // Format helpers
    const fmtDuration = (secs) => {
        if (!secs) return '0h';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return `${h}h ${m}m`;
    };

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="border-b p-4 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-lg font-semibold">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 font-medium">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(selectedDate, 'MMM dd, yyyy')}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* 1. Daily Totals Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="border rounded-lg p-4 bg-card shadow-sm">
                            <div className="text-sm text-muted-foreground mb-1">Total Work</div>
                            <div className="text-2xl font-bold flex items-baseline gap-1">
                                {fmtDuration(stats?.totals?.work_seconds)}
                                <span className="text-xs font-normal text-muted-foreground">hrs</span>
                            </div>
                        </div>
                        <div className="border rounded-lg p-4 bg-card shadow-sm">
                            <div className="text-sm text-muted-foreground mb-1">Total Break</div>
                            <div className="text-2xl font-bold flex items-baseline gap-1">
                                {fmtDuration(stats?.totals?.break_seconds)}
                                <span className="text-xs font-normal text-muted-foreground">hrs</span>
                            </div>
                        </div>
                        <div className="border rounded-lg p-4 bg-card shadow-sm">
                            <div className="text-sm text-muted-foreground mb-1">Idle Time</div>
                            <div className="text-2xl font-bold flex items-baseline gap-1">
                                {fmtDuration(stats?.totals?.idle_seconds)}
                                <span className="text-xs font-normal text-muted-foreground">hrs</span>
                            </div>
                        </div>
                        <div className="border rounded-lg p-4 bg-card shadow-sm">
                            <div className="text-sm text-muted-foreground mb-1">Current Status</div>
                            <div className={`text-xl font-bold capitalize ${stats?.totals?.status === 'online' ? 'text-green-600' :
                                stats?.totals?.status === 'break' ? 'text-yellow-600' : 'text-muted-foreground'
                                }`}>
                                {stats?.totals?.status === 'break' ? 'On Break' : stats?.totals?.status || 'Offline'}
                            </div>
                        </div>
                    </div>

                    {/* 2. Hourly Timeline Chart */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Hourly Activity</h3>
                        <div className="border rounded-lg p-4 bg-card shadow-sm">
                            <div className="h-40 flex items-end justify-between gap-1 mt-4 px-2">
                                {stats?.hourly?.map((h) => (
                                    <ActivityBar key={h.hour} active={h.active_seconds} idle={h.idle_seconds} hour={h.hour} />
                                ))}
                            </div>
                            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-sm" /> Active
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-orange-300 rounded-sm" /> Idle
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Detailed Activity Log Table */}
                    <div className="space-y-2 pb-10">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Session & Break Logs</h3>
                        <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Start Time</th>
                                        <th className="px-4 py-3">End Time</th>
                                        <th className="px-4 py-3">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {stats?.logs?.length === 0 ? (
                                        <tr><td colSpan="4" className="px-4 py-8 text-center text-muted-foreground italic">No activity recorded for this day.</td></tr>
                                    ) : (
                                        stats?.logs?.map((log, i) => (
                                            <tr key={i} className="hover:bg-muted/20">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded textxs font-medium capitalize ${log.type === 'session' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">{new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="px-4 py-3">
                                                    {log.end_time ? new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-green-600 font-medium italic">Active</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono">{fmtDuration(log.duration)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
