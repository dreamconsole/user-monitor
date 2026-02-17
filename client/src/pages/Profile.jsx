import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { toast } from 'sonner';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Shield, Building2, Clock, Key } from 'lucide-react';

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(6),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export default function Profile() {
    const { user } = useAuthStore();
    const [changingPassword, setChangingPassword] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
        resolver: zodResolver(passwordSchema),
    });

    const onChangePassword = async (data) => {
        try {
            await api.post('/auth/change-password', {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });
            toast.success('Password changed successfully');
            reset();
            setChangingPassword(false);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to change password');
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
                <p className="text-muted-foreground">View and manage your account information.</p>
            </div>

            {/* Profile Info Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`} alt={user?.name} />
                            <AvatarFallback className="text-xl bg-primary text-primary-foreground">{user?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-xl">{user?.name}</CardTitle>
                            <CardDescription>{user?.email}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <User className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Full Name</p>
                                <p className="font-medium">{user?.name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="font-medium">{user?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Role</p>
                                <p className="font-medium capitalize">{user?.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Organization</p>
                                <p className="font-medium">{user?.org_name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Timezone</p>
                                <p className="font-medium">{user?.timezone || 'UTC'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Change Password Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Key className="w-5 h-5" />
                                Password & Security
                            </CardTitle>
                            <CardDescription>Change your account password.</CardDescription>
                        </div>
                        {!changingPassword && (
                            <Button variant="outline" onClick={() => setChangingPassword(true)}>
                                Change Password
                            </Button>
                        )}
                    </div>
                </CardHeader>
                {changingPassword && (
                    <CardContent>
                        <Separator className="mb-4" />
                        <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input id="currentPassword" type="password" {...register('currentPassword')} />
                                {errors.currentPassword && (
                                    <span className="text-red-500 text-sm">{errors.currentPassword.message}</span>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input id="newPassword" type="password" {...register('newPassword')} />
                                {errors.newPassword && (
                                    <span className="text-red-500 text-sm">{errors.newPassword.message}</span>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                                {errors.confirmPassword && (
                                    <span className="text-red-500 text-sm">{errors.confirmPassword.message}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : 'Save Password'}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => { setChangingPassword(false); reset(); }}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
