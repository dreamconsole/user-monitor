import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function SuperAdminOrgs() {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const orgsRes = await api.get('/superadmin/orgs');
            setOrgs(orgsRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load organizations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateOrgLimit = async (orgId, newLimit) => {
        try {
            await api.put(`/superadmin/orgs/${orgId}`, { max_users_limit: parseInt(newLimit) });
            setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, max_users_limit: parseInt(newLimit) } : o));
            toast.success('Updated organization users limit');
        } catch (error) {
            toast.error('Failed to update organization limit');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
                <p className="text-muted-foreground mt-2">Manage user limits and subscriptions across all tenants.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Tenants</CardTitle>
                    <CardDescription>A list of all organizations registered in the system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Organization Name</TableHead>
                                <TableHead>Domain</TableHead>
                                <TableHead>Current Users</TableHead>
                                <TableHead>Max Users Limit</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orgs.map((org) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>{org.domain || 'N/A'}</TableCell>
                                    <TableCell>{org.current_users}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                defaultValue={org.max_users_limit}
                                                className="w-24 border-slate-300"
                                                onBlur={(e) => {
                                                    if (e.target.value != org.max_users_limit) {
                                                        updateOrgLimit(org.id, e.target.value);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${org.is_active ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-red-50 text-red-700 ring-red-600/20'}`}>
                                            {org.is_active ? 'Active' : 'Deactivated'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {orgs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No organizations found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
