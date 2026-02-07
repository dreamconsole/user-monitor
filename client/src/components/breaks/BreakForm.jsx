import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
    name: z.string().min(2, "Name is required"),
    max_duration_minutes: z.number().min(1, "Duration must be at least 1 minute").nullable(),
    is_paid: z.boolean(),
    is_active: z.boolean(),
});

export default function BreakForm({ breakItem, onSubmit, isSubmitting }) {
    const isEdit = !!breakItem;

    const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            max_duration_minutes: 30,
            is_paid: false,
            is_active: true,
        }
    });

    useEffect(() => {
        if (breakItem) {
            reset({
                name: breakItem.name,
                max_duration_minutes: breakItem.max_duration_seconds ? breakItem.max_duration_seconds / 60 : null,
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
                    <Label htmlFor="max_duration_minutes">Max Duration (Minutes)</Label>
                    <Input
                        id="max_duration_minutes"
                        type="number"
                        {...register('max_duration_minutes', { valueAsNumber: true })}
                    />
                    {errors.max_duration_minutes && <span className="text-destructive text-sm">{errors.max_duration_minutes.message}</span>}
                </div>

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
