import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import TeamForm from '@/components/teams/TeamForm';
import TeamMembersForm from '@/components/teams/TeamMembersForm';

export default function Teams() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form Sheet State
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Members Sheet State
    const [membersSheetOpen, setMembersSheetOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);

    const fetchTeams = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/teams');
            setTeams(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load teams');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const handleCreate = () => {
        setEditingTeam(null);
        setSheetOpen(true);
    };

    const handleEdit = (team) => {
        setEditingTeam(team);
        setSheetOpen(true);
    };

    const handleManageMembers = (team) => {
        setSelectedTeam(team);
        setMembersSheetOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this team? Members will be unassigned.')) return;
        try {
            await api.delete(`/teams/${id}`);
            setTeams(teams.filter(t => t.id !== id));
            toast.success('Team deleted successfully');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete team');
        }
    };

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            if (editingTeam) {
                await api.put(`/teams/${editingTeam.id}`, data);
                toast.success('Team updated');
            } else {
                await api.post('/teams', data);
                toast.success('Team created');
            }
            setSheetOpen(false);
            fetchTeams();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
                <div className="border rounded-lg bg-card p-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Teams Management</h1>
                    <p className="text-muted-foreground">Manage your organization's teams and their members.</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Team
                </Button>
            </div>

            <div className="border rounded-lg bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Team Name</TableHead>
                            <TableHead>Break Group</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Members</TableHead>
                            <TableHead>Managers</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teams.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="w-8 h-8 opacity-40" />
                                        <span>No teams found. Create one to get started.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {teams.map((team) => (
                            <TableRow key={team.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium">{team.name}</TableCell>
                                <TableCell>
                                    {team.break_group_name ? (
                                        <Badge variant="outline">{team.break_group_name}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground italic text-xs">Org Default</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{team.description || '—'}</TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center bg-primary/10 text-primary w-6 h-6 rounded-full text-xs font-medium">
                                        {team.total_members}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {team.managers && team.managers.length > 0 ? (
                                        <div className="flex gap-1 flex-wrap">
                                            {team.managers.map((m, i) => (
                                                <span key={i} className="text-xs bg-muted border px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    {m.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">No managers</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleManageMembers(team)} title="Manage Members">
                                            <Users className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(team)} title="Edit Team">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(team.id)} title="Delete Team">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Create/Edit Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-[440px] w-full">
                    <SheetHeader>
                        <SheetTitle>{editingTeam ? 'Edit Team' : 'Create New Team'}</SheetTitle>
                        <SheetDescription>
                            {editingTeam ? 'Update team metadata.' : 'Define a new work group.'}
                        </SheetDescription>
                    </SheetHeader>
                    <TeamForm team={editingTeam} onSubmit={onSubmit} isSubmitting={isSubmitting} />
                </SheetContent>
            </Sheet>

            {/* Manage Members Sheet */}
            <Sheet open={membersSheetOpen} onOpenChange={setMembersSheetOpen}>
                <SheetContent className="sm:max-w-[500px] w-full">
                    <SheetHeader>
                        <SheetTitle>Manage Members</SheetTitle>
                        <SheetDescription>
                            Add or remove users from <strong>{selectedTeam?.name}</strong>.
                        </SheetDescription>
                    </SheetHeader>
                    {selectedTeam && (
                        <TeamMembersForm team={selectedTeam} onMembersUpdated={fetchTeams} />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
