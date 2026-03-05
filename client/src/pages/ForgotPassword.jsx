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
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import bgImage from '@/assets/login_bg.png';
import logoLight from '@/assets/logo-light.png';

const schema = z.object({
    email: z.string().email('Please enter a valid email address'),
});

export default function ForgotPassword() {
    const [sent, setSent] = useState(false);
    const [resetToken, setResetToken] = useState(null);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data) => {
        try {
            const res = await api.post('/auth/forgot-password', { email: data.email });
            setSent(true);
            // In development, show the reset token directly
            if (res.data.resetToken) {
                setResetToken(res.data.resetToken);
            }
            toast.success('Reset instructions sent');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to send reset email');
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
                {/* Left Image Section */}
                <div className="hidden lg:flex flex-col justify-between p-12 text-white relative">
                    <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url(${bgImage})` }}>
                        <div className="absolute inset-0 bg-black/20 z-10 mix-blend-overlay" />
                    </div>
                    <div className="relative z-20 flex items-center mb-10">
                        <img src={logoLight} alt="Source Code Kart Logo" className="h-16 md:h-20 w-auto drop-shadow-md" />
                    </div>
                    <div className="relative z-20 mt-auto pb-12">
                        <h1 className="text-4xl font-bold tracking-tight mb-4 drop-shadow-md">Recover Account</h1>
                        <p className="text-lg text-white/90 max-w-md drop-shadow-md">We'll help you get back into your account securely.</p>
                    </div>
                </div>

                {/* Right Form Section */}
                <div className="flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-background relative w-full">
                    <div className="absolute inset-0 bg-muted/40 lg:hidden" />
                    <Card className="w-full max-w-md relative z-10 shadow-xl border-border/60">
                        <CardHeader className="text-center">
                            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <CardTitle className="text-2xl">Check your email</CardTitle>
                            <CardDescription>
                                If an account exists with that email, we've sent password reset instructions.
                            </CardDescription>
                        </CardHeader>
                        {resetToken && (
                            <CardContent>
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                                    <p className="font-medium text-yellow-800 mb-1">Development Mode</p>
                                    <p className="text-yellow-700 break-all">
                                        Reset Token: <code className="text-xs">{resetToken}</code>
                                    </p>
                                    <Link
                                        to={`/reset-password?token=${resetToken}`}
                                        className="inline-block mt-2 text-primary hover:underline font-medium"
                                    >
                                        Click here to reset password
                                    </Link>
                                </div>
                            </CardContent>
                        )}
                        <CardFooter className="flex justify-center">
                            <Link to="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
                                <ArrowLeft className="w-4 h-4" /> Back to Login
                            </Link>
                        </CardFooter>
                    </Card>
                    <div className="absolute bottom-6 w-full text-center text-sm text-muted-foreground z-10">
                        copyright 2026 sourcecodekart.com
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
            {/* Left Image Section */}
            <div className="hidden lg:flex flex-col justify-between p-12 text-white relative">
                <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url(${bgImage})` }}>
                    <div className="absolute inset-0 bg-black/20 z-10 mix-blend-overlay" />
                </div>
                <div className="relative z-20 flex items-center mb-10">
                    <img src={logoLight} alt="Source Code Kart Logo" className="h-16 md:h-20 w-auto drop-shadow-md" />
                </div>
                <div className="relative z-20 mt-auto pb-12">
                    <h1 className="text-4xl font-bold tracking-tight mb-4 drop-shadow-md">Recover Account</h1>
                    <p className="text-lg text-white/90 max-w-md drop-shadow-md">We'll help you get back into your account securely.</p>
                </div>
            </div>

            {/* Right Form Section */}
            <div className="flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-background relative w-full">
                <div className="absolute inset-0 bg-muted/40 lg:hidden" />
                <Card className="w-full max-w-md relative z-10 shadow-xl border-border/60">
                    <CardHeader>
                        <CardTitle className="text-2xl">Forgot Password</CardTitle>
                        <CardDescription>Enter your email and we'll send you reset instructions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="email" type="email" className="pl-10" placeholder="you@example.com" {...register('email')} />
                                </div>
                                {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Link to="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> Back to Login
                        </Link>
                    </CardFooter>
                </Card>
                <div className="absolute bottom-6 w-full text-center text-sm text-muted-foreground z-10">
                    copyright 2026 sourcecodekart.com
                </div>
            </div>
        </div>
    );
}
