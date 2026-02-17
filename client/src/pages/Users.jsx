import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, LogOut, Filter, X, Users as UsersIcon } from 'lucide-react';
import UserForm from '@/components/users/UserForm';
import UserActivityDetail from '@/components/users/UserActivityDetail';
import { utcToLocal } from '@/lib/dateUtils';

export default function Users() {
    const { user: currentUser } = useAuthStore();
    const [searchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Sheet
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Detail Drawer
    const [detailUser, setDetailUser] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Filters
    const filterStatus = searchParams.get('status'); // 'offline'

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Apply Filter logic whenever users or query param changes
    useEffect(() => {
        if (!users.length) return;

        if (filterStatus === 'offline') {
            const now = Date.now();
            setFilteredUsers(users.filter(u => {
                if (!u.last_heartbeat) return true;
                const lastHeartbeat = new Date(u.last_heartbeat).getTime();
                return (now - lastHeartbeat) > 2 * 60 * 1000; // Older than 2 mins
            }));
        } else if (filterStatus === 'online') {
            const now = Date.now();
            setFilteredUsers(users.filter(u => {
                if (!u.last_heartbeat) return false;
                const lastHeartbeat = new Date(u.last_heartbeat).getTime();
                return (now - lastHeartbeat) < 2 * 60 * 1000; // Recent < 2 mins
            }));
        } else {
            setFilteredUsers(users);
        }
    }, [users, filterStatus]);

    const handleCreate = () => {
        setEditingUser(null);
        setSheetOpen(true);
    };

    const handleEdit = (e, user) => {
        e.stopPropagation();
        setEditingUser(user);
        setSheetOpen(true);
    };

    const handleRowClick = (user) => {
        setDetailUser(user);
        setDetailOpen(true);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (error) {
            toast.error('Failed to delete user');
        }
    };

    const handleForceLogout = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Force logout this user? They will be signed out on their next agent heartbeat.')) return;
        try {
            await api.post(`/users/${id}/force-logout`);
            toast.success('Force logout command sent');
        } catch (error) {
            toast.error('Failed to send force logout command');
        }
    };

    const onSubmit = async (data, features) => {
        setIsSubmitting(true);
        try {
            if (editingUser) {
                const { data: updated } = await api.patch(`/users/${editingUser.id}`, data);
                if (features) await api.patch(`/users/${editingUser.id}/features`, { features });
                setUsers(users.map(u => u.id === updated.id ? updated : u));
            } else {
                const { data: newUser } = await api.post('/users', data);
                setUsers([newUser, ...users]);
            }
            setSheetOpen(false);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isAdmin = currentUser?.role === 'orgadmin';
    const isManager = currentUser?.role === 'manager';
    const canManage = isAdmin || isManager;

    // Helper to check status
    const getUserStatus = (user) => {
        if (user.is_on_break) return 'break';
        if (!user.last_heartbeat) return 'offline';
        const diff = Date.now() - new Date(user.last_heartbeat).getTime();
        return diff < 2 * 60 * 1000 ? 'online' : 'offline';
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
                        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
                    </div>
                </div>
                <div className="border rounded-lg bg-card shadow-sm p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 py-3">
                            <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                            <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                            <div className="h-4 flex-[0.5] bg-muted animate-pulse rounded" />
                            <div className="h-4 flex-[0.5] bg-muted animate-pulse rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage employees and view activity.</p>
                </div>
                <div className="flex items-center gap-2">
                    {filterStatus && (
                        <Badge variant="secondary" className="px-3 py-1 flex items-center gap-1">
                            Filter: {filterStatus}
                            <a href="/users" className="ml-1 hover:text-primary"><X className="w-3 h-3" /></a>
                        </Badge>
                    )}
                    {isAdmin && (
                        <Button onClick={handleCreate}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add New User
                        </Button>
                    )}
                </div>
            </div>

            <div className="border rounded-lg bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[250px]">User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Platform</TableHead>
                            {canManage && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <UsersIcon className="w-8 h-8 opacity-40" />
                                        <span>No users found</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredUsers.map((user) => {
                            const status = getUserStatus(user);
                            const statusColor = {
                                online: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
                                break: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]',
                                offline: 'bg-slate-300'
                            }[status];

                            const statusText = {
                                online: 'text-green-600',
                                break: 'text-yellow-600',
                                offline: 'text-muted-foreground'
                            }[status];

                            return (
                                <TableRow
                                    key={user.id}
                                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                                    onClick={() => handleRowClick(user)}
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`relative h-2.5 w-2.5 rounded-full ${statusColor}`} />
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.name}</span>
                                                {user.id === currentUser.id && <span className="text-[10px] text-primary uppercase font-bold">You</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                    <TableCell><Badge variant="outline" className="capitalize font-normal text-xs">{user.role}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className={`text-xs font-medium capitalize ${statusText}`}>
                                                {status === 'break' ? 'On Break' : status}
                                            </span>
                                            {status === 'offline' && user.last_heartbeat && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    last seen {utcToLocal(user.last_heartbeat, currentUser.timezone, 'HH:mm')}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {/* Placeholder for OS/Platform if we had it */}
                                        ---
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {(isAdmin || (isManager && user.manager_id === currentUser.id)) && (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:bg-orange-50" onClick={(e) => handleForceLogout(e, user.id)} title="Force Logout">
                                                            <LogOut className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleEdit(e, user)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {isAdmin && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, user.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Create/Edit Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-[440px] w-full">
                    <SheetHeader>
                        <SheetTitle>{editingUser ? 'Edit User' : 'Create New User'}</SheetTitle>
                        <SheetDescription>
                            {editingUser ? 'Update user details.' : 'Add a new member to your team.'}
                        </SheetDescription>
                    </SheetHeader>
                    <UserForm user={editingUser} onSubmit={onSubmit} isSubmitting={isSubmitting} />
                </SheetContent>
            </Sheet>

            {/* Detail Drawer - 80% Width */}
            <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
                <SheetContent className="sm:max-w-[80vw] w-full p-0 sm:p-0" hideClose={true}>
                    <SheetHeader className="sr-only">
                        <SheetTitle>User Activity Details</SheetTitle>
                        <SheetDescription>View hourly activity and logs</SheetDescription>
                    </SheetHeader>
                    <UserActivityDetail user={detailUser} onClose={() => setDetailOpen(false)} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
