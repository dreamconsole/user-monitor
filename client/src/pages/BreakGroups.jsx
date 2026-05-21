import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, CheckCircle2 } from 'lucide-react';
import BreakGroupForm from '@/components/breaks/BreakGroupForm';

export default function BreakGroups() {
    const { user } = useAuthStore();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchGroups = async () => {
        try {
            const { data } = await api.get('/break-groups');
            setGroups(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreate = () => {
        setEditingGroup(null);
        setSheetOpen(true);
    };

    const handleEdit = (item) => {
        setEditingGroup(item);
        setSheetOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this break group? This will unassign it from any linked teams.')) return;
        try {
            await api.delete(`/break-groups/${id}`);
            setGroups(groups.filter(g => g.id !== id));
            toast.success('Break group deleted successfully');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete break group');
        }
    };

    const handleSetDefault = async (id) => {
        if (!window.confirm('Set this group as the organization default?')) return;
        try {
            await api.patch(`/break-groups/${id}`, { is_default: true });
            toast.success('Default group updated');
            fetchGroups(); // Refresh to recalculate sorting and update past default
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to set default group');
        }
    }

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            if (editingGroup) {
                await api.patch(`/break-groups/${editingGroup.id}`, data);
            } else {
                await api.post('/break-groups', data);
            }
            setSheetOpen(false);
            fetchGroups(); // Refresh after save
            toast.success('Break group saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
                        <div className="h-4 w-72 bg-muted animate-pulse rounded" />
                    </div>
                </div>
                <div className="border rounded-lg bg-card shadow-sm p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex gap-4 py-3">
                            <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                            <div className="h-4 flex-[0.5] bg-muted animate-pulse rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (user?.features?.is_breaks_enabled === false) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center mt-12 bg-card rounded-lg shadow border py-16">
                <h2 className="text-xl font-bold mb-2">Break Management Disabled</h2>
                <p className="text-muted-foreground">Break management is disabled for your organization.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Break Groups</h1>
                    <p className="text-muted-foreground">Manage organizational break policies and assignments.</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Break Group
                </Button>
            </div>

            <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Group Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Default</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {item.name}
                                        {item.is_default && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100">Org Default</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                                <TableCell>
                                    {!item.is_default && (
                                        <Button variant="outline" size="sm" className="h-8" onClick={() => handleSetDefault(item.id)}>
                                            Mark Default
                                        </Button>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={item.is_default}
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                            onClick={() => handleDelete(item.id)}
                                            title={item.is_default ? "Cannot delete the default group" : "Delete group"}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {groups.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border-t italic">
                        No break groups defined yet.
                    </div>
                )}
            </div>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-[440px] w-full">
                    <SheetHeader>
                        <SheetTitle className="text-2xl">{editingGroup ? 'Edit Break Group' : 'Create Break Group'}</SheetTitle>
                        <SheetDescription>
                            Configure a group that assigns specific breaks. Teams can be assigned break groups.
                        </SheetDescription>
                    </SheetHeader>
                    <BreakGroupForm groupItem={editingGroup} onSubmit={onSubmit} isSubmitting={isSubmitting} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
