import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Pencil, Trash2, Power, PowerOff, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function SuperAdminOrgs() {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        domain: '',
        max_users_limit: 10,
        timezone: 'UTC',
        adminName: '',
        adminEmail: '',
        adminPassword: ''
    });

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

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/superadmin/orgs', formData);
            toast.success('Organization and Admin created successfully');
            setIsCreateOpen(false);
            setFormData({
                name: '',
                domain: '',
                max_users_limit: 10,
                timezone: 'UTC',
                adminName: '',
                adminEmail: '',
                adminPassword: ''
            });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create organization');
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/superadmin/orgs/${selectedOrg.id}`, formData);
            toast.success('Organization updated successfully');
            setIsEditOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to update organization');
        }
    };

    const toggleStatus = async (org) => {
        try {
            await api.put(`/superadmin/orgs/${org.id}`, { is_active: !org.is_active });
            toast.success(`Organization ${org.is_active ? 'deactivated' : 'activated'}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const toggleCampaigns = async (org) => {
        try {
            await api.put(`/superadmin/orgs/${org.id}`, { is_campaigns_enabled: !org.is_campaigns_enabled });
            toast.success(`Campaigns ${org.is_campaigns_enabled ? 'disabled' : 'enabled'} for ${org.name}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update campaigns feature');
        }
    };

    const openEdit = (org) => {
        setSelectedOrg(org);
        setFormData({
            name: org.name,
            domain: org.domain || '',
            max_users_limit: org.max_users_limit,
            timezone: org.timezone || 'UTC'
        });
        setIsEditOpen(true);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
                    <p className="text-muted-foreground mt-2">Manage user limits and subscriptions across all tenants.</p>
                </div>
                <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <SheetTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create Organization
                        </Button>
                    </SheetTrigger>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>New Organization</SheetTitle>
                            <SheetDescription>Setup a new tenant and its first administrator.</SheetDescription>
                        </SheetHeader>
                        <form onSubmit={handleCreate} className="space-y-4 py-6">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-sm border-b pb-1">Organization Info</h4>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Organization Name</Label>
                                    <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="domain">Domain (optional)</Label>
                                    <Input id="domain" placeholder="example.com" value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="limit">User Limit</Label>
                                        <Input id="limit" type="number" required value={formData.max_users_limit} onChange={e => setFormData({ ...formData, max_users_limit: parseInt(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="timezone">Timezone</Label>
                                        <Input id="timezone" value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold text-sm border-b pb-1">Initial Admin Credentials</h4>
                                <div className="space-y-2">
                                    <Label htmlFor="adminName">Admin Full Name</Label>
                                    <Input id="adminName" required placeholder="John Doe" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="adminEmail">Admin Email</Label>
                                    <Input id="adminEmail" type="email" required placeholder="admin@org.com" value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="adminPassword">Admin Password</Label>
                                    <Input id="adminPassword" type="password" required value={formData.adminPassword} onChange={e => setFormData({ ...formData, adminPassword: e.target.value })} />
                                </div>
                            </div>

                            <SheetFooter className="pt-6">
                                <Button type="submit" className="w-full">Create Org & Admin</Button>
                            </SheetFooter>
                        </form>
                    </SheetContent>
                </Sheet>
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
                                <TableHead>Campaigns</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orgs.map((org) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>{org.domain || 'N/A'}</TableCell>
                                    <TableCell>{org.current_users}</TableCell>
                                    <TableCell>{org.max_users_limit}</TableCell>
                                    <TableCell>
                                        <Badge variant={org.is_campaigns_enabled ? 'default' : 'secondary'} className="text-xs gap-1">
                                            <Megaphone className="w-3 h-3" />
                                            {org.is_campaigns_enabled ? 'On' : 'Off'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${org.is_active ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-red-50 text-red-700 ring-red-600/20'}`}>
                                            {org.is_active ? 'Active' : 'Deactivated'}
                                        </span>
                                    </TableCell>

                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => openEdit(org)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => toggleCampaigns(org)}
                                                    className={org.is_campaigns_enabled ? 'text-orange-600' : 'text-violet-600'}
                                                >
                                                    <Megaphone className="mr-2 h-4 w-4" />
                                                    {org.is_campaigns_enabled ? 'Disable Campaigns' : 'Enable Campaigns'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => toggleStatus(org)}
                                                    className={org.is_active ? 'text-red-600' : 'text-green-600'}
                                                >
                                                    {org.is_active ? (
                                                        <>
                                                            <PowerOff className="mr-2 h-4 w-4" />
                                                            Deactivate
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Power className="mr-2 h-4 w-4" />
                                                            Activate
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Edit Organization</SheetTitle>
                        <SheetDescription>Update tenant properties.</SheetDescription>
                    </SheetHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 py-6">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Organization Name</Label>
                            <Input id="edit-name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-domain">Domain (optional)</Label>
                            <Input id="edit-domain" placeholder="example.com" value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-limit">Max Users Limit</Label>
                            <Input id="edit-limit" type="number" required value={formData.max_users_limit} onChange={e => setFormData({ ...formData, max_users_limit: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-timezone">Timezone</Label>
                            <Input id="edit-timezone" value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} />
                        </div>
                        <SheetFooter className="pt-4">
                            <Button type="submit" className="w-full">Save Changes</Button>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    );
}
