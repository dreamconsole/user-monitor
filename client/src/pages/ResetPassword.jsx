import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Lock } from 'lucide-react';

const schema = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [success, setSuccess] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data) => {
        if (!token) {
            toast.error('Missing reset token');
            return;
        }
        try {
            await api.post('/auth/reset-password', {
                token,
                newPassword: data.newPassword,
            });
            setSuccess(true);
            toast.success('Password reset successfully');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to reset password');
        }
    };

    if (!token) {
        return (
            <div className="h-screen flex items-center justify-center bg-muted/40">
                <Card className="w-full max-w-md mx-4">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-red-600">Invalid Link</CardTitle>
                        <CardDescription>
                            This reset link is invalid or has expired. Please request a new one.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                            Request new reset link
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="h-screen flex items-center justify-center bg-muted/40">
                <Card className="w-full max-w-md mx-4">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl">Password Reset</CardTitle>
                        <CardDescription>
                            Your password has been successfully reset. You can now log in with your new password.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Button onClick={() => navigate('/login')}>Go to Login</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-screen flex items-center justify-center bg-muted/40">
            <Card className="w-full max-w-md mx-4">
                <CardHeader>
                    <CardTitle className="text-2xl">Set New Password</CardTitle>
                    <CardDescription>Enter your new password below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input id="newPassword" type="password" className="pl-10" {...register('newPassword')} />
                            </div>
                            {errors.newPassword && <span className="text-red-500 text-sm">{errors.newPassword.message}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input id="confirmPassword" type="password" className="pl-10" {...register('confirmPassword')} />
                            </div>
                            {errors.confirmPassword && <span className="text-red-500 text-sm">{errors.confirmPassword.message}</span>}
                        </div>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Resetting...' : 'Reset Password'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link to="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
