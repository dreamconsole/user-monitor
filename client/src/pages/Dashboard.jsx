import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
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
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Total Employees"
                    value={stats.totalUsers}
                    icon={UsersIcon}
                    desc="Registered in organization"
                />
                <KpiCard
                    label="Active Now"
                    value={stats.activeUsers}
                    icon={Activity}
                    desc="Agent sending heartbeats"
                    color="text-green-500"
                />
                <KpiCard
                    label="Work Hours Today"
                    value={`${stats.totalWorkHours}h`}
                    icon={Clock}
                    desc="Cumulative across all users"
                />
                <KpiCard
                    label="Absent Today"
                    value={stats.notLoggedInCount}
                    icon={UserMinus}
                    desc="Users with no session today"
                    color="text-orange-500"
                />
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Organization Productivity</CardTitle>
                    <CardDescription>Comparison of productive work vs. idle time today.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="h-6 w-full bg-muted rounded-full overflow-hidden flex">
                            <div
                                className="bg-primary h-full transition-all"
                                style={{ width: `${(stats.totalWorkHours / (parseFloat(stats.totalWorkHours) + parseFloat(stats.totalIdleHours) || 1)) * 100}%` }}
                            />
                            <div
                                className="bg-orange-300 h-full transition-all"
                                style={{ width: `${(stats.totalIdleHours / (parseFloat(stats.totalWorkHours) + parseFloat(stats.totalIdleHours) || 1)) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-primary rounded-sm" />
                                <span>Work Hours: {stats.totalWorkHours}h</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-orange-300 rounded-sm" />
                                <span>Idle Hours: {stats.totalIdleHours}h</span>
                            </div>
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
                                                <Badge variant="secondary">Offline</Badge>
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

    useEffect(() => {
        const fetchStats = async () => {
            try {
                let endpoint = '/stats/user';
                if (user.role === 'orgadmin') endpoint = '/stats/admin';
                else if (user.role === 'manager') endpoint = '/stats/manager';

                const { data } = await api.get(endpoint);
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchStats();
    }, [user]);

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
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name}</h1>
                <p className="text-muted-foreground">Here's what's happening in {user.org_name || 'your organization'} today.</p>
            </div>

            {user.role === 'orgadmin' && <AdminDashboard stats={stats} />}
            {user.role === 'manager' && <ManagerDashboard stats={stats} />}
            {user.role === 'user' && <UserDashboard stats={stats} />}
        </div>
    );
}
