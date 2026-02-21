import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Server, Activity, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function SuperAdminOverview() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const healthRes = await api.get('/superadmin/health');
            setHealth(healthRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load system health data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">SuperAdmin Overview</h2>
                    <p className="text-muted-foreground mt-2">At-a-glance health metrics for the entire User Monitor ecosystem.</p>
                </div>
                <div className="hidden md:flex p-3 bg-red-50 rounded-full border border-red-100">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-4">
                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Server Uptime</CardTitle>
                        <Server className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{Math.floor(health?.uptime / 3600)}h</div>
                        <p className="text-xs text-muted-foreground mt-1">Hours since last restart</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-indigo-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Organizations</CardTitle>
                        <Building2 className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{health?.total_orgs}</div>
                        <p className="text-xs text-muted-foreground mt-1">Registered tenants</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{health?.active_users}</div>
                        <p className="text-xs text-muted-foreground mt-1">In active organizations</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Agent Sessions</CardTitle>
                        <Activity className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{health?.active_agent_sessions}</div>
                        <p className="text-xs text-muted-foreground mt-1">Live valid tokens</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
