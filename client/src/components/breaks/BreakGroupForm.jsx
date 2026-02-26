import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
    name: z.string().min(2, "Name is required"),
    description: z.string().optional()
});

export default function BreakGroupForm({ groupItem, onSubmit, isSubmitting }) {
    const isEdit = !!groupItem;

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            description: ''
        }
    });

    useEffect(() => {
        if (groupItem) {
            reset({
                name: groupItem.name,
                description: groupItem.description || ''
            });
        }
    }, [groupItem, reset]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Group Name</Label>
                    <Input id="name" {...register('name')} placeholder="e.g. Standard Shift, Night Shift" />
                    {errors.name && <span className="text-destructive text-sm">{errors.name.message}</span>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                        id="description"
                        {...register('description')}
                        placeholder="Brief description of this break policy group"
                        rows={3}
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
                <Button type="submit" disabled={isSubmitting}>
                    {isEdit ? 'Update Group' : 'Create Group'}
                </Button>
            </div>
        </form>
    );
}
