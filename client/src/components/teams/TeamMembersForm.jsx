import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function TeamMembersForm({ team, onMembersUpdated }) {
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');

    const fetchData = async () => {
        try {
            const [membersRes, usersRes] = await Promise.all([
                api.get(`/teams/${team.id}/members`),
                api.get('/users?limit=1000') // fetch all users for the dropdown
            ]);
            setMembers(membersRes.data);
            setAllUsers(usersRes.data);
        } catch (error) {
            console.error('Failed to load members or users:', error);
            toast.error('Failed to load team data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (team?.id) {
            fetchData();
        }
    }, [team]);

    const handleAddMember = async () => {
        if (!selectedUserId) return;
        setIsAdding(true);
        try {
            const user = unassignedUsers.find(u => u.id === selectedUserId);
            if (user && user.team_id && user.team_id !== team.id) {
                const confirmed = window.confirm(`This user currently belongs to another team. Are you sure you want to move them to ${team.name}?`);
                if (!confirmed) {
                    setIsAdding(false);
                    return;
                }
            }

            await api.post(`/teams/${team.id}/members`, {
                user_ids: [selectedUserId],
                role: 'employee'
            });
            toast.success('Member added successfully');
            setSelectedUserId('');
            await fetchData();
            if (onMembersUpdated) onMembersUpdated();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to add member');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this user from the team?')) return;
        try {
            await api.delete(`/teams/${team.id}/members/${userId}`);
            toast.success('Member removed');
            await fetchData();
            if (onMembersUpdated) onMembersUpdated();
        } catch (error) {
            toast.error('Failed to remove member');
        }
    };

    if (loading) {
        return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    }

    const unassignedUsers = allUsers.filter(u => !members.some(m => m.id === u.id));

    return (
        <div className="space-y-6 mt-6">
            <div className="bg-muted/30 p-4 border rounded-lg space-y-4">
                <h4 className="font-medium text-sm">Add New Member</h4>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a user to add" />
                            </SelectTrigger>
                            <SelectContent>
                                {unassignedUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.name} ({u.email}) - {u.role}
                                    </SelectItem>
                                ))}
                                {unassignedUsers.length === 0 && (
                                    <SelectItem value="none" disabled>No available users</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAddMember} disabled={!selectedUserId || isAdding}>
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        Add
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="font-medium text-sm">Current Members ({members.length})</h4>
                <div className="border rounded-lg divide-y bg-card">
                    {members.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            No members assigned to this team yet.
                        </div>
                    ) : (
                        members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                                <div>
                                    <p className="font-medium text-sm">{member.name}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="capitalize text-[10px]">{member.role}</Badge>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveMember(member.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
