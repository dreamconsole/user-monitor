import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import api from '@/lib/api';

const schema = z.object({
    name: z.string().min(2, "Name is required"),
    break_group_id: z.string().min(1, "Break Group is required"),
    break_type: z.enum(['flexible', 'fixed']),
    fixed_start_time: z.string().optional().nullable(),
    fixed_end_time: z.string().optional().nullable(),
    max_duration_minutes: z.number().min(1, "Duration must be at least 1 minute").nullable().optional(),
    daily_limit: z.number().min(1).nullable().optional(),
    is_paid: z.boolean(),
    is_active: z.boolean(),
}).refine((data) => {
    if (data.break_type === 'fixed') {
        return !!data.fixed_start_time && !!data.fixed_end_time;
    }
    return true;
}, {
    message: "Start and End times are required for Fixed breaks",
    path: ["fixed_start_time"]
});

export default function BreakForm({ breakItem, onSubmit, isSubmitting }) {
    console.log("BreakForm render - breakItem:", breakItem);
    const isEdit = !!breakItem;

    const [groups, setGroups] = useState([]);
    console.log("BreakForm render - groups:", groups);
    const [loadingGroups, setLoadingGroups] = useState(true);

    const { register, handleSubmit, setValue, reset, watch, control, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: breakItem?.name || '',
            break_group_id: breakItem?.break_group_id ? String(breakItem.break_group_id) : '',
            break_type: breakItem?.break_type || 'flexible',
            fixed_start_time: breakItem?.fixed_start_time ? breakItem.fixed_start_time.substring(0, 5) : '',
            fixed_end_time: breakItem?.fixed_end_time ? breakItem.fixed_end_time.substring(0, 5) : '',
            max_duration_minutes: breakItem?.max_duration_seconds ? breakItem.max_duration_seconds / 60 : 30,
            daily_limit: breakItem?.daily_limit || null,
            is_paid: breakItem ? breakItem.is_paid : false,
            is_active: breakItem ? breakItem.is_active : true,
        }
    });

    const breakType = watch('break_type');
    const breakGroupId = watch('break_group_id');

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const { data } = await api.get('/break-groups');
                setGroups(data);
                // Preselect default group if drafting new break
                if (!breakItem && data.length > 0) {
                    const defaultGrp = data.find(g => g.is_default);
                    if (defaultGrp) setValue('break_group_id', String(defaultGrp.id));
                    else setValue('break_group_id', String(data[0].id));
                }
            } catch (error) {
                console.error('Failed to load groups', error);
            } finally {
                setLoadingGroups(false);
            }
        };
        fetchGroups();
    }, [breakItem, setValue]);

    useEffect(() => {
        if (breakItem) {
            reset({
                name: breakItem.name,
                break_group_id: breakItem.break_group_id ? String(breakItem.break_group_id) : '',
                break_type: breakItem.break_type || 'flexible',
                fixed_start_time: breakItem.fixed_start_time ? breakItem.fixed_start_time.substring(0, 5) : '',
                fixed_end_time: breakItem.fixed_end_time ? breakItem.fixed_end_time.substring(0, 5) : '',
                max_duration_minutes: breakItem.max_duration_seconds ? breakItem.max_duration_seconds / 60 : null,
                daily_limit: breakItem.daily_limit || null,
                is_paid: breakItem.is_paid,
                is_active: breakItem.is_active,
            });
        }
    }, [breakItem, reset]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Break Name</Label>
                    <Input id="name" {...register('name')} placeholder="e.g. Lunch, Short Break" />
                    {errors.name && <span className="text-destructive text-sm">{errors.name.message}</span>}
                </div>

                <div className="space-y-2">
                    <Label>Assign to Break Group</Label>
                    <Select 
                        key={`bg-${groups.length}-${breakItem?.id || 'new'}`}
                        disabled={loadingGroups} 
                        value={watch('break_group_id') || undefined} 
                        onValueChange={(val) => setValue('break_group_id', val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a break group"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                            {groups.map(g => (
                                <SelectItem key={g.id} value={String(g.id)}>
                                    {g.name} {g.is_default && '(Default)'}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.break_group_id && <span className="text-destructive text-sm">{errors.break_group_id.message}</span>}
                </div>

                <div className="space-y-2">
                    <Label>Break Type Structure</Label>
                    <Select value={breakType} onValueChange={(val) => setValue('break_type', val, { shouldValidate: true })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="flexible">Flexible (Take anytime within limits)</SelectItem>
                            <SelectItem value="fixed">Fixed (Strict schedule timeframe)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {breakType === 'flexible' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max_duration_minutes">Max Duration (Mins)</Label>
                            <Input
                                id="max_duration_minutes"
                                type="number"
                                {...register('max_duration_minutes', { valueAsNumber: true })}
                                placeholder="e.g. 30"
                            />
                            {errors.max_duration_minutes && <span className="text-destructive text-sm">{errors.max_duration_minutes.message}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="daily_limit">Daily Limit (Uses/Day)</Label>
                            <Input
                                id="daily_limit"
                                type="number"
                                {...register('daily_limit', { valueAsNumber: true })}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fixed_start_time">Start Time</Label>
                            <Input
                                id="fixed_start_time"
                                type="time"
                                {...register('fixed_start_time')}
                            />
                            {errors.fixed_start_time && <span className="text-destructive text-sm">{errors.fixed_start_time.message}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fixed_end_time">End Time</Label>
                            <Input
                                id="fixed_end_time"
                                type="time"
                                {...register('fixed_end_time')}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Paid Break</Label>
                        <p className="text-xs text-muted-foreground">Is this break counted as working time?</p>
                    </div>
                    <Switch
                        checked={watch('is_paid')}
                        onCheckedChange={(val) => setValue('is_paid', val)}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Active</Label>
                        <p className="text-xs text-muted-foreground">Disable to hide this break from the agent.</p>
                    </div>
                    <Switch
                        checked={watch('is_active')}
                        onCheckedChange={(val) => setValue('is_active', val)}
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
                <Button type="submit" disabled={isSubmitting}>
                    {isEdit ? 'Update Break Type' : 'Create Break Type'}
                </Button>
            </div>
        </form>
    );
}
