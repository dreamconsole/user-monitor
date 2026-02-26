import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

const teamSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    break_group_id: z.string().optional().nullable(),
    max_members: z.coerce.number().min(1, 'Must be at least 1').optional().or(z.literal(''))
});

export default function TeamForm({ team, onSubmit, isSubmitting }) {
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(true);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(teamSchema),
        defaultValues: {
            name: team?.name || '',
            description: team?.description || '',
            break_group_id: team?.break_group_id || null,
            max_members: team?.max_members || ''
        }
    });

    const breakGroupId = watch('break_group_id');

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const { data } = await api.get('/break-groups');
                setGroups(data);
            } catch (error) {
                console.error('Failed to fetch break groups', error);
            } finally {
                setLoadingGroups(false);
            }
        };
        fetchGroups();
    }, []);

    useEffect(() => {
        if (team) {
            reset({
                name: team.name,
                description: team.description || '',
                break_group_id: team.break_group_id || null,
                max_members: team.max_members || ''
            });
        } else {
            reset({ name: '', description: '', break_group_id: null, max_members: '' });
        }
    }, [team, reset]);

    const handleFormSubmit = (data) => {
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 mt-6">
            <div className="space-y-2">
                <Label htmlFor="name">Team Name <span className="text-destructive">*</span></Label>
                <Input
                    id="name"
                    {...register('name')}
                    placeholder="Engineering, Support, etc."
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="max_members">Max Members Capacity (Optional)</Label>
                <Input
                    id="max_members"
                    type="number"
                    min="1"
                    {...register('max_members')}
                    placeholder="Leave blank for unlimited"
                />
                {errors.max_members && <p className="text-sm text-destructive">{errors.max_members.message}</p>}
            </div>

            <div className="space-y-2">
                <Label>Break Policy Group (Optional)</Label>
                <Select disabled={loadingGroups} value={breakGroupId || "org_default"} onValueChange={(val) => setValue('break_group_id', val === 'org_default' ? null : val)}>
                    <SelectTrigger>
                        <SelectValue placeholder={loadingGroups ? "Loading..." : "Organization Default"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                        <SelectItem value="org_default">Use Organization Default</SelectItem>
                        {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>
                                {g.name} {g.is_default && '(Default)'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Briefly describe this team's purpose"
                    rows={3}
                />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {team ? 'Update Team' : 'Create Team'}
                </Button>
            </div>
        </form>
    );
}
