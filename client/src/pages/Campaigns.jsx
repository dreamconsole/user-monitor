import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Building2, User } from 'lucide-react';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Campaigns() {
    const { user } = useAuthStore();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState(null);

    const [newCampaignName, setNewCampaignName] = useState('');
    const [saving, setSaving] = useState(false);

    // Assignment state
    const [teams, setTeams] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [assignmentTargetType, setAssignmentTargetType] = useState('team'); // 'team' or 'user'
    const [selectedTargetIds, setSelectedTargetIds] = useState([]);

    const fetchCampaigns = async () => {
        try {
            const { data } = await api.get('/campaigns');
            setCampaigns(data);
        } catch (error) {
            toast.error('Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignmentData = async (campaignId) => {
        try {
            const [teamsRes, usersRes, assignRes] = await Promise.all([
                api.get('/teams'),
                api.get('/users'),
                api.get(`/campaigns/${campaignId}/assignments`)
            ]);
            setTeams(teamsRes.data);
            setUsersList(usersRes.data);
            setAssignments(assignRes.data);
        } catch (error) {
            toast.error('Failed to load assignment data');
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const handleCreateCampaign = async () => {
        if (!newCampaignName.trim()) {
            toast.error('Campaign name is required');
            return;
        }

        setSaving(true);
        try {
            await api.post('/campaigns', { name: newCampaignName });
            toast.success('Campaign created');
            setIsCreateModalOpen(false);
            setNewCampaignName('');
            fetchCampaigns();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create campaign');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCampaign = async (id) => {
        if (!confirm('Are you sure you want to delete this campaign? Tracking records associated with it might be affected.')) return;

        try {
            await api.delete(`/campaigns/${id}`);
            toast.success('Campaign deleted');
            fetchCampaigns();
        } catch (error) {
            toast.error('Failed to delete campaign');
        }
    };

    const openAssignModal = (campaign) => {
        setSelectedCampaign(campaign);
        setSelectedTargetIds([]);
        setAssignmentTargetType('team');
        setIsAssignModalOpen(true);
        fetchAssignmentData(campaign.id);
    };

    const handleAssign = async () => {
        if (selectedTargetIds.length === 0) {
            toast.error('Please select at least one target');
            return;
        }

        setSaving(true);
        try {
            await api.post(`/campaigns/${selectedCampaign.id}/assign`, {
                target_type: assignmentTargetType,
                target_ids: selectedTargetIds
            });
            toast.success('Campaign assigned successfully');
            setSelectedTargetIds([]);
            fetchAssignmentData(selectedCampaign.id); // refresh list
        } catch (error) {
            toast.error('Failed to assign campaign');
        } finally {
            setSaving(false);
        }
    };

    const removeAssignment = async (assignmentId) => {
        try {
            await api.delete(`/campaigns/${selectedCampaign.id}/assignments/${assignmentId}`);
            toast.success('Assignment removed');
            fetchAssignmentData(selectedCampaign.id);
        } catch (error) {
            toast.error('Failed to remove assignment');
        }
    };

    if (loading) return <div className="p-8">Loading campaigns...</div>;
    
    if (user?.features?.is_campaigns_enabled === false) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center mt-12 bg-white rounded-lg shadow border py-16">
                <h2 className="text-xl font-bold mb-2 text-slate-800">Campaigns Module Disabled</h2>
                <p className="text-slate-500 mb-6">The campaign management module is currently disabled for your organization. Please enable it in Settings to use this feature.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 h-[85vh] overflow-y-auto pr-4 pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
                    <p className="text-muted-foreground">Manage and assign campaigns to users or teams.</p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create Campaign
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                    {campaigns.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No campaigns created yet. Click "Create Campaign" to get started.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={c.is_active ? "success" : "secondary"}>
                                                {c.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => openAssignModal(c)}>
                                                <Users className="h-4 w-4 mr-2" /> Assign
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCampaign(c.id)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Campaign</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input
                                value={newCampaignName}
                                onChange={(e) => setNewCampaignName(e.target.value)}
                                placeholder="E.g., Q3 Sales Outreach"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCampaign} disabled={saving || !newCampaignName}>
                            {saving ? 'Creating...' : 'Create Campaign'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Modal */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Assign Campaign: {selectedCampaign?.name}</DialogTitle>
                        <p className="text-sm text-muted-foreground">Assign to teams or individual users. Avoid duplicate assignments.</p>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-6 py-4">
                        <div className="space-y-4 border-r pr-6">
                            <h3 className="font-semibold pb-2 border-b">Add Assignment</h3>
                            
                            <div className="flex space-x-2 mb-4">
                                <Button 
                                    size="sm" 
                                    variant={assignmentTargetType === 'team' ? 'default' : 'outline'}
                                    onClick={() => { setAssignmentTargetType('team'); setSelectedTargetIds([]); }}
                                >
                                    <Building2 className="w-4 h-4 mr-2" /> Teams
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={assignmentTargetType === 'user' ? 'default' : 'outline'}
                                    onClick={() => { setAssignmentTargetType('user'); setSelectedTargetIds([]); }}
                                >
                                    <User className="w-4 h-4 mr-2" /> Users
                                </Button>
                            </div>

                            <div className="h-64 overflow-y-auto border rounded p-2">
                                {assignmentTargetType === 'team' ? (
                                    teams.length === 0 ? <p className="text-sm text-muted-foreground p-2">No teams found.</p> :
                                    teams.map(t => (
                                        <div key={t.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                                            <input
                                                type="checkbox"
                                                id={`team-${t.id}`}
                                                checked={selectedTargetIds.includes(t.id)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setSelectedTargetIds([...selectedTargetIds, t.id]);
                                                    else setSelectedTargetIds(selectedTargetIds.filter(id => id !== t.id));
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                            />
                                            <label htmlFor={`team-${t.id}`} className="text-sm cursor-pointer flex-1">{t.name}</label>
                                        </div>
                                    ))
                                ) : (
                                    usersList.length === 0 ? <p className="text-sm text-muted-foreground p-2">No users found.</p> :
                                    usersList.map(u => (
                                        <div key={u.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                                            <input
                                                type="checkbox"
                                                id={`u-${u.id}`}
                                                checked={selectedTargetIds.includes(u.id)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setSelectedTargetIds([...selectedTargetIds, u.id]);
                                                    else setSelectedTargetIds(selectedTargetIds.filter(id => id !== u.id));
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                            />
                                            <label htmlFor={`u-${u.id}`} className="text-sm cursor-pointer flex-1">
                                                {u.full_name} <span className="text-xs text-muted-foreground">({u.email})</span>
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>

                            <Button className="w-full" onClick={handleAssign} disabled={saving || selectedTargetIds.length === 0}>
                                {saving ? 'Assigning...' : `Assign to ${selectedTargetIds.length} ${assignmentTargetType}(s)`}
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold pb-2 border-b">Current Assignments</h3>
                            <div className="h-[320px] overflow-y-auto">
                                {assignments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No active assignments for this campaign.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {assignments.map(a => (
                                            <div key={a.assignment_id} className="flex items-center justify-between p-2 text-sm border rounded bg-slate-50">
                                                <div className="flex items-center">
                                                    {a.team_id ? <Building2 className="w-4 h-4 mr-2 text-slate-500" /> : <User className="w-4 h-4 mr-2 text-slate-500" />}
                                                    <span>{a.team_id ? a.team_name : a.user_name}</span>
                                                    <Badge variant="outline" className="ml-2 text-[10px]">{a.team_id ? 'Team' : 'User'}</Badge>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => removeAssignment(a.assignment_id)} className="h-6 w-6 p-0 text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
