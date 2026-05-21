import { useEffect, useState } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import BreakForm from '@/components/breaks/BreakForm';

export default function Breaks() {
    const { user } = useAuthStore();
    const [breaks, setBreaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingBreak, setEditingBreak] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchBreaks = async () => {
        try {
            const { data } = await api.get('/breaks');
            setBreaks(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBreaks();
    }, []);

    const handleCreate = () => {
        setEditingBreak(null);
        setSheetOpen(true);
    };

    const handleEdit = (item) => {
        setEditingBreak(item);
        setSheetOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this break type?')) return;
        try {
            await api.delete(`/breaks/${id}`);
            setBreaks(breaks.filter(b => b.id !== id));
        } catch (error) {
            toast.error('Failed to delete break type');
        }
    };

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            if (editingBreak) {
                const { data: updated } = await api.patch(`/breaks/${editingBreak.id}`, data);
                setBreaks(breaks.map(b => b.id === updated.id ? updated : b));
            } else {
                const { data: newBreak } = await api.post('/breaks', data);
                setBreaks([...breaks, newBreak]);
            }
            setSheetOpen(false);
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
                    <h1 className="text-3xl font-bold tracking-tight">Break Management</h1>
                    <p className="text-muted-foreground">Define and manage break types available for your organization.</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Break Type
                </Button>
            </div>

            <div className="border rounded-lg bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Break Name</TableHead>
                            <TableHead>Assigned Group</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Rules</TableHead>
                            <TableHead>Compensation</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {breaks.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>
                                    {item.group_name ? (
                                        <Badge variant="outline">{item.group_name}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground italic text-sm">Unassigned</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="capitalize">{item.break_type || 'flexible'}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                    {item.break_type === 'fixed' ? (
                                        <span>{item.fixed_start_time} - {item.fixed_end_time}</span>
                                    ) : (
                                        <div className="flex flex-col gap-0.5">
                                            <span>{item.max_duration_seconds ? `${item.max_duration_seconds / 60} minutes` : 'No limit'}</span>
                                            {item.daily_limit && <span className="text-xs text-muted-foreground">Max {item.daily_limit}x/day</span>}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={item.is_paid ? 'default' : 'secondary'}>
                                        {item.is_paid ? 'Paid' : 'Unpaid'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={item.is_active ? 'outline' : 'destructive'} className={item.is_active ? 'bg-green-50 text-green-700 border-green-200' : ''}>
                                        {item.is_active ? 'Active' : 'Disabled'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(item.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {breaks.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border-t italic">
                        No break types defined yet.
                    </div>
                )}
            </div>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-[440px] w-full">
                    <SheetHeader>
                        <SheetTitle className="text-2xl">{editingBreak ? 'Edit Break Type' : 'Create Break Type'}</SheetTitle>
                        <SheetDescription>
                            Configure break settings for all members of your organization.
                        </SheetDescription>
                    </SheetHeader>
                    <BreakForm breakItem={editingBreak} onSubmit={onSubmit} isSubmitting={isSubmitting} />
                </SheetContent>
            </Sheet>
        </div >
    );
}
