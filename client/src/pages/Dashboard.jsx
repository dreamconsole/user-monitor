import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import useWebSocket from '@/lib/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Activity,
    Users as UsersIcon,
    Clock,
    Zap,
    AlertTriangle,
    UserCheck,
    UserMinus,
    BarChart3,
    Calendar
} from 'lucide-react';
import { utcToLocal } from '@/lib/dateUtils';

const KpiCard = ({ label, value, icon: Icon, desc, color }) => (
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
            <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{desc}</p>
        </CardContent>
    </Card>
);

const AdminDashboard = ({ stats }) => {
    // Normalize trend data to always render 7 bars.
    const trendMap = new Map(
        (stats.productivityTrend || []).map((item) => [
            String(item.date).slice(0, 10),
            {
                date: String(item.date).slice(0, 10),
                work_seconds: Number(item.work_seconds || 0),
                idle_seconds: Number(item.idle_seconds || 0)
            }
        ])
    );
    const trendData = Array.from({ length: 7 }, (_, idx) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (6 - idx));
        const key = d.toISOString().slice(0, 10);
        return trendMap.get(key) || { date: key, work_seconds: 0, idle_seconds: 0 };
    });
    const maxHours = Math.max(
        12,
        ...trendData.map((d) => (Number(d.work_seconds) + Number(d.idle_seconds)) / 3600)
    );
    const onlineCount = Number(stats.statusDistribution?.online || 0);
    const offlineCount = Number(stats.statusDistribution?.offline || 0);
    const totalUsers = onlineCount + offlineCount;
    const onlinePct = totalUsers > 0 ? (onlineCount / totalUsers) * 100 : 0;
    const offlinePct = totalUsers > 0 ? (offlineCount / totalUsers) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link to="/users">
                    <KpiCard
                        label="Total Employees"
                        value={stats.totalUsers}
                        icon={UsersIcon}
                        desc="Registered in organization"
                        color="hover:bg-muted/50 transition-colors cursor-pointer"
                    />
                </Link>
                <Link to="/users?status=online">
                    <KpiCard
                        label="Active Now"
                        value={stats.activeUsers}
                        icon={Activity}
                        desc="Agent sending heartbeats"
                        color="text-green-500 hover:bg-muted/50 transition-colors cursor-pointer"
                    />
                </Link>
                <KpiCard
                    label="Work Hours Today"
                    value={`${stats.totalWorkHours}h`}
                    icon={Clock}
                    desc="Cumulative across all users"
                />
                <Link to="/users?status=offline">
                    <KpiCard
                        label="Absent Today"
                        value={stats.notLoggedInCount}
                        icon={UserMinus}
                        desc="Users with no session today"
                        color="text-orange-500 hover:bg-muted/50 transition-colors cursor-pointer"
                    />
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Productivity Mix */}
                <Card className="shadow-sm col-span-1">
                    <CardHeader>
                        <CardTitle>Productivity Mix</CardTitle>
                        <CardDescription>Work vs. Idle time today.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div className="relative h-48 w-48 mx-auto">
                                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="20" fill="transparent" className="text-muted/20" />
                                    <circle
                                        cx="50" cy="50" r="40"
                                        stroke="currentColor" strokeWidth="20"
                                        fill="transparent"
                                        strokeDasharray={`${(stats.totalWorkHours / (parseFloat(stats.totalWorkHours) + parseFloat(stats.totalIdleHours) || 1)) * 251.2} 251.2`}
                                        className="text-primary transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold">{stats.totalWorkHours}h</span>
                                    <span className="text-xs text-muted-foreground">Work</span>
                                </div>
                            </div>
                            <div className="flex justify-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-primary rounded-full" />
                                    <span>Work ({parseFloat(stats.totalWorkHours || 0).toFixed(1)}h)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-muted rounded-full" />
                                    <span>Idle ({parseFloat(stats.totalIdleHours || 0).toFixed(1)}h)</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 7-Day Trend */}
                <Card className="shadow-sm col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            7-Day Productivity Trend
                        </CardTitle>
                        <CardDescription>Daily active hours over the last week.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[240px] flex items-end justify-between gap-4 pt-4">
                            {trendData.map((day, i) => {
                                const workH = Number(day.work_seconds) / 3600;
                                const idleH = Number(day.idle_seconds) / 3600;
                                const totalH = workH + idleH;
                                const rawHeightPct = maxHours > 0 ? (totalH / (maxHours * 1.1)) * 100 : 0;
                                const heightPct = totalH > 0 ? Math.max(rawHeightPct, 6) : 0;

                                return (
                                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group">
                                        <div className="w-full bg-muted/30 rounded-t-md relative flex flex-col-reverse overflow-hidden hover:bg-muted/40 transition-colors" style={{ height: `${heightPct}%` }}>
                                            {/* Work Segment */}
                                            <div
                                                className="bg-primary w-full transition-all"
                                                style={{ height: `${(workH / (totalH || 1)) * 100}%` }}
                                                title={`Work: ${workH.toFixed(1)}h`}
                                            />
                                            <div
                                                className="bg-orange-300 w-full transition-all"
                                                style={{ height: `${(idleH / (totalH || 1)) * 100}%` }}
                                                title={`Idle: ${idleH.toFixed(1)}h`}
                                            />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-[10px] text-muted-foreground uppercase block">{utcToLocal(day.date, stats.orgTimezone, 'EEE')}</span>
                                            <span className="text-[10px] font-bold">{totalH.toFixed(1)}h</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Distribution Heatmap-ish Row */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Real-time Workforce Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-8 w-full rounded-md overflow-hidden bg-muted/20 border">
                        {totalUsers === 0 ? (
                            <div className="text-xs text-muted-foreground w-full text-center py-1">No users found</div>
                        ) : (
                            <div className="h-full w-full flex">
                                <div
                                    className="h-full bg-green-500 hover:opacity-90 transition-opacity"
                                    style={{ width: `${onlinePct}%` }}
                                    title={`Online: ${onlineCount} (${onlinePct.toFixed(1)}%)`}
                                />
                                <div
                                    className="h-full bg-slate-300 hover:opacity-90 transition-opacity"
                                    style={{ width: `${offlinePct}%` }}
                                    title={`Offline: ${offlineCount} (${offlinePct.toFixed(1)}%)`}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <div className="font-medium text-green-600">
                            {onlineCount} Online ({onlinePct.toFixed(1)}%)
                        </div>
                        <div>
                            {offlineCount} Offline ({offlinePct.toFixed(1)}%)
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

const ManagerDashboard = ({ stats }) => {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <KpiCard
                    label="Team Size"
                    value={stats.teamSummary.length}
                    icon={UsersIcon}
                    desc="Users reporting to you"
                />
                <KpiCard
                    label="Late Logins"
                    value={stats.lateLoginsCount}
                    icon={AlertTriangle}
                    desc="Sessions started after 9:30 AM"
                    color={stats.lateLoginsCount > 0 ? "text-red-500" : "text-green-500"}
                />
                <KpiCard
                    label="High Idle Warning"
                    value={stats.highIdleCount}
                    icon={Zap}
                    desc="Users with > 30% idle time"
                    color={stats.highIdleCount > 0 ? "text-orange-500" : "text-green-500"}
                />
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Team Activity Summary</CardTitle>
                    <CardDescription>Real-time view of your team's work today.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6 text-xs uppercase font-bold">User</TableHead>
                                <TableHead className="text-xs uppercase font-bold">Work Time</TableHead>
                                <TableHead className="text-xs uppercase font-bold">Idle %</TableHead>
                                <TableHead className="text-xs uppercase font-bold">Logon</TableHead>
                                <TableHead className="pr-6 text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.teamSummary.map((member, i) => {
                                const workSecs = Number(member.work_seconds || 0);
                                const idleSecs = Number(member.idle_seconds || 0);
                                const total = workSecs + idleSecs;
                                const idlePercent = total > 0 ? (idleSecs / total * 100).toFixed(0) : 0;
                                return (
                                    <TableRow key={i}>
                                        <TableCell className="pl-6 font-medium">{member.name}</TableCell>
                                        <TableCell>{(workSecs / 3600).toFixed(1)}h</TableCell>
                                        <TableCell>
                                            <span className={Number(idlePercent) > 30 ? 'text-orange-500 font-bold' : ''}>
                                                {idlePercent}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {member.start_time ? utcToLocal(member.start_time, member.timezone, 'HH:mm') : '---'}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            {member.start_time ? (
                                                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
                                            ) : (
                                                <Link to={`/users?status=offline`}>
                                                    <Badge variant="secondary" className="hover:bg-muted-foreground/20 cursor-pointer">Offline</Badge>
                                                </Link>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

const UserDashboard = ({ stats }) => {
    const today = stats.today || { total_work_seconds: 0, total_idle_seconds: 0 };
    const workSecs = Number(today.total_work_seconds || 0);
    const idleSecs = Number(today.total_idle_seconds || 0);
    const workHours = (workSecs / 3600).toFixed(1);
    const idleHours = (idleSecs / 3600).toFixed(1);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">My Work Today</CardTitle>
                        <Clock className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{workHours}h</div>
                        <p className="text-xs text-muted-foreground">Productive time recorded</p>
                        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all"
                                style={{ width: `${(workSecs / (workSecs + idleSecs || 1)) * 100}%` }}
                            />
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            <span>Idle: {idleHours}h</span>
                            <span>{((workSecs / (workSecs + idleSecs || 1)) * 100).toFixed(0)}% Efficiency</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sessions Status</CardTitle>
                        <Zap className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{today.status || 'No Active Session'}</div>
                        <p className="text-xs text-muted-foreground">
                            {today.start_time ? `Started at ${utcToLocal(today.start_time, stats.userTimezone, 'HH:mm')}` : 'Please start the agent to track time'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Weekly Progress</CardTitle>
                            <CardDescription>Your work hours for the last 7 days.</CardDescription>
                        </div>
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] flex items-end justify-between gap-2 pt-6">
                        {stats.weekly.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground italic text-sm">No data for the past week</div>
                        ) : (
                            stats.weekly.map((day, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <div
                                        className="w-full bg-primary/20 hover:bg-primary transition-all rounded-t-sm relative group"
                                        style={{ height: `${(day.hours / 12) * 100}%`, minHeight: '4px' }}
                                    >
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                            {Number(day.hours).toFixed(1)}h
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground uppercase">{utcToLocal(day.date, stats.userTimezone, 'EEE')}</span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            let endpoint = '/stats/user';
            if (user.role === 'orgadmin') endpoint = '/stats/admin';
            else if (user.role === 'manager') endpoint = '/stats/manager';

            const { data } = await api.get(endpoint);
            setStats(data);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // WebSocket for real-time updates
    const handleWsMessage = useCallback((data) => {
        if (data.type === 'USER_HEARTBEAT' || data.type === 'ACTIVITY_UPDATE') {
            // Refresh dashboard when we get real-time events
            fetchStats();
        }
    }, [fetchStats]);

    const { connected } = useWebSocket(handleWsMessage);

    useEffect(() => {
        if (user) fetchStats();
    }, [user, fetchStats]);

    if (loading) return (
        <div className="flex items-center justify-center h-[50vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground animate-pulse leading-none">Loading your dashboard...</p>
            </div>
        </div>
    );

    if (!stats) return <div className="p-8 text-center text-muted-foreground">Unable to load dashboard data.</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name}</h1>
                    <p className="text-muted-foreground">Here's what's happening in {user.org_name || 'your organization'} today.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    {connected ? 'Live' : 'Offline'}
                </div>
            </div>

            {user.role === 'orgadmin' && <AdminDashboard stats={stats} />}
            {user.role === 'manager' && <ManagerDashboard stats={stats} />}
            {user.role === 'user' && <UserDashboard stats={stats} />}
        </div>
    );
}
