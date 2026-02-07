import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, LogOut, ShieldAlert } from 'lucide-react';
import UserForm from '@/components/users/UserForm';
import { utcToLocal } from '@/lib/dateUtils';

export default function Users() {
    const { user: currentUser } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleCreate = () => {
        setEditingUser(null);
        setSheetOpen(true);
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setSheetOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    const handleForceLogout = async (id) => {
        if (!window.confirm('Force logout this user? They will be signed out on their next agent heartbeat.')) return;
        try {
            await api.post(`/users/${id}/force-logout`);
            alert('Force logout command sent');
        } catch (error) {
            alert('Failed to send force logout command');
        }
    };

    const onSubmit = async (data, features) => {
        setIsSubmitting(true);
        try {
            if (editingUser) {
                const { data: updated } = await api.patch(`/users/${editingUser.id}`, data);

                // Save feature overrides if editing and features were changed
                if (features) {
                    await api.patch(`/users/${editingUser.id}/features`, { features });
                }

                setUsers(users.map(u => u.id === updated.id ? updated : u));
            } else {
                const { data: newUser } = await api.post('/users', data);
                setUsers([newUser, ...users]);
            }
            setSheetOpen(false);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isAdmin = currentUser?.role === 'orgadmin';
    const isManager = currentUser?.role === 'manager';
    const canManage = isAdmin || isManager;

    if (loading) return <div className="p-8">Loading users...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage employees, assign managers, and control active sessions.</p>
                </div>
                {isAdmin && (
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add New User
                    </Button>
                )}
            </div>

            <div className="border rounded-lg bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[180px]">User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Emp ID</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Manager</TableHead>
                            <TableHead>Last Activity</TableHead>
                            <TableHead>Status</TableHead>
                            {canManage && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{user.name}</span>
                                        {user.id === currentUser.id && <span className="text-[10px] text-primary uppercase font-bold tracking-wider">You</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                <TableCell className="font-mono text-xs">{user.emp_id || '-'}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="capitalize font-normal">{user.role}</Badge>
                                </TableCell>
                                <TableCell>
                                    {user.manager_id ? (
                                        <span className="text-sm">{users.find(u => u.id === user.manager_id)?.name || 'Unknown'}</span>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">No Manager</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span className={`text-[10px] uppercase font-bold ${user.last_heartbeat ? 'text-primary' : 'text-muted-foreground'}`}>
                                            {user.last_heartbeat ? 'Agent Active' : 'No Agent'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {user.last_heartbeat
                                                ? utcToLocal(user.last_heartbeat, user.timezone, 'MMM dd, HH:mm')
                                                : user.last_login_at
                                                    ? `Login: ${utcToLocal(user.last_login_at, user.timezone, 'MMM dd, HH:mm')}`
                                                    : 'Never'
                                            }
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.status === 'active' ? 'default' : 'destructive'} className="capitalize">
                                        {user.status}
                                    </Badge>
                                </TableCell>
                                {canManage && (
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {/* Managers can only force logout, only admins can edit/delete */}
                                            {(isAdmin || (isManager && user.manager_id === currentUser.id)) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                    onClick={() => handleForceLogout(user.id)}
                                                    title="Force Logout"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                </Button>
                                            )}

                                            {isAdmin && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(user)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(user.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {users.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border-t italic">
                        No users found in your organization.
                    </div>
                )}
            </div>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-[440px] w-full">
                    <SheetHeader>
                        <SheetTitle className="text-2xl">{editingUser ? 'Edit User' : 'Create New User'}</SheetTitle>
                        <SheetDescription>
                            {editingUser
                                ? 'Update account details and organizational settings.'
                                : 'Fill in the information below to add a new member to your team.'}
                        </SheetDescription>
                    </SheetHeader>
                    <UserForm user={editingUser} onSubmit={onSubmit} isSubmitting={isSubmitting} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
