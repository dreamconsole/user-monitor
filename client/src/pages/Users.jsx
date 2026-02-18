import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, LogOut, X, Users as UsersIcon, Search } from 'lucide-react';
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

    // Search & Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [accountFilter, setAccountFilter] = useState('all');
    const filterStatus = searchParams.get('status'); // 'offline' or 'online' from URL

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

    // Apply all filters whenever any filter or users change
    useEffect(() => {
        if (!users.length) { setFilteredUsers([]); return; }

        let result = [...users];

        // Search by name or email
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(u =>
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.emp_id?.toLowerCase().includes(q)
            );
        }

        // Role filter
        if (roleFilter !== 'all') {
            result = result.filter(u => u.role === roleFilter);
        }

        // Account status filter (active/suspended)
        if (accountFilter === 'active') {
            result = result.filter(u => u.status === 'active');
        } else if (accountFilter === 'suspended') {
            result = result.filter(u => u.status === 'suspended');
        }

        // Online/Offline filter from URL params
        if (filterStatus === 'offline') {
            const now = Date.now();
            result = result.filter(u => {
                if (!u.last_heartbeat) return true;
                return (now - new Date(u.last_heartbeat).getTime()) > 2 * 60 * 1000;
            });
        } else if (filterStatus === 'online') {
            const now = Date.now();
            result = result.filter(u => {
                if (!u.last_heartbeat) return false;
                return (now - new Date(u.last_heartbeat).getTime()) < 2 * 60 * 1000;
            });
        }

        setFilteredUsers(result);
    }, [users, searchQuery, roleFilter, accountFilter, filterStatus]);

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
                {isAdmin && (
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add New User
                    </Button>
                )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="orgadmin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-[150px] h-9">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                </Select>
                {filterStatus && (
                    <Badge variant="secondary" className="px-3 py-1.5 flex items-center gap-1">
                        {filterStatus}
                        <a href="/users" className="ml-1 hover:text-primary"><X className="w-3 h-3" /></a>
                    </Badge>
                )}
                {(searchQuery || roleFilter !== 'all' || accountFilter !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setRoleFilter('all'); setAccountFilter('all'); }} className="h-9 gap-1 text-muted-foreground">
                        <X className="h-3 w-3" /> Clear
                    </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                    {filteredUsers.length} of {users.length} users
                </span>
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
