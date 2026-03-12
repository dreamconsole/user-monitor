import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Server, Activity, Users, Building2, Cpu, HardDrive, LayoutDashboard, Database, Trash2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function SuperAdminOverview() {
    const [health, setHealth] = useState(null);
    const [dbStats, setDbStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [healthRes, dbRes] = await Promise.all([
                api.get('/superadmin/health'),
                api.get('/superadmin/db-stats')
            ]);
            setHealth(healthRes.data);
            setDbStats(dbRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load system health data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Update every 1m
        return () => clearInterval(interval);
    }, []);

    const handleCleanup = async (days) => {
        if (!confirm(`Are you sure you want to delete all logs and screenshots older than ${days} days? This cannot be undone.`)) return;

        setCleaning(true);
        try {
            const res = await api.post('/superadmin/cleanup', { days });
            toast.success('Database cleanup successful');
            console.log('Cleanup result:', res.data);
            fetchData();
        } catch (error) {
            toast.error('Failed to perform cleanup');
        } finally {
            setCleaning(false);
        }
    };

    if (loading && !health) return <div>Loading...</div>;

    const sys = health?.system || {};

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">SuperAdmin Overview</h2>
                    <p className="text-muted-foreground mt-1">Real-time infrastructure and ecosystem health metrics.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <div className="hidden md:flex p-3 bg-red-50 rounded-full border border-red-100 shadow-sm">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4">
                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Server Uptime</CardTitle>
                        <Server className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{Math.floor(health?.uptime / 3600)}h</div>
                        <p className="text-xs text-muted-foreground mt-1">Hours since last process start</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-indigo-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Organizations</CardTitle>
                        <Building2 className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{health?.total_orgs}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total registered tenants</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{health?.active_users}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active users across all orgs</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Agent Sessions</CardTitle>
                        <Activity className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{health?.active_agent_sessions}</div>
                        <p className="text-xs text-muted-foreground mt-1">Concurrent active agent sessions</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 pt-4">
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Cpu className="w-5 h-5" />
                        Infrastructure Health
                    </h3>
                    <div className="grid gap-4">
                        <Card className="shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">RAM Usage</CardTitle>
                                <LayoutDashboard className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl font-bold">{sys.memory?.percent}</span>
                                    <span className="text-xs text-muted-foreground">{sys.memory?.used} / {sys.memory?.total}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${parseFloat(sys.memory?.percent) > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                                        style={{ width: sys.memory?.percent }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">CPU Status</CardTitle>
                                <Cpu className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl font-bold">{sys.cpu?.load}</span>
                                    <span className="text-xs text-muted-foreground">{sys.cpu?.cores} Cores - {sys.cpu?.model?.split(' ')[0]}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">System Load Average (1m)</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Disk Storage</CardTitle>
                                <HardDrive className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl font-bold">{sys.disk?.percent}</span>
                                    <span className="text-xs text-muted-foreground">{sys.disk?.used} used of {sys.disk?.total}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${parseFloat(sys.disk?.percent) > 90 ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: sys.disk?.percent }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">{sys.disk?.free} available space</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Database Optimization
                    </h3>
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Table Size Breakdown</CardTitle>
                            <CardDescription>Identify high-growth tables and screenshot storage.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-md">
                                    <div className="flex items-center gap-2">
                                        <HardDrive className="w-4 h-4 text-blue-500" />
                                        <span className="text-sm font-medium">Screenshot Files</span>
                                    </div>
                                    <span className="text-sm font-bold">{dbStats?.uploads_folder_size}</span>
                                </div>

                                <div className="max-h-[250px] overflow-y-auto border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="text-xs uppercase tracking-wider">Table</TableHead>
                                                <TableHead className="text-right text-xs uppercase tracking-wider">Size</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dbStats?.tables?.map((table) => (
                                                <TableRow key={table.table_name}>
                                                    <TableCell className="text-sm py-2">{table.table_name}</TableCell>
                                                    <TableCell className="text-right text-sm font-medium py-2">{table.total_size}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="pt-4 border-t space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold">Retention Policy</h4>
                                        <span className="text-xs text-muted-foreground italic">Affects Logs & Screenshots</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs"
                                            onClick={() => handleCleanup(30)}
                                            disabled={cleaning}
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            30 Days
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs"
                                            onClick={() => handleCleanup(90)}
                                            disabled={cleaning}
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            90 Days
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="text-xs"
                                            onClick={() => handleCleanup(180)}
                                            disabled={cleaning}
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            180 Days
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        Note: Cleanup will permanently delete activity logs, browser history, and physical screenshot files older than the selected period.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
