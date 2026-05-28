import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { FaApple, FaMicrosoft } from 'react-icons/fa';
import bgImage from '@/assets/login_bg.png';
import logoLight from '@/assets/logo-light.png';

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export default function Login() {
    const { login, getSSOStatus, verifySSO } = useAuthStore();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [ssoStatus, setSsoStatus] = useState({ google: false, microsoft: false, apple: false });

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await getSSOStatus();
                setSsoStatus(status);
            } catch (err) {
                console.error("Failed to fetch SSO status", err);
            }
        };
        fetchStatus();
    }, [getSSOStatus]);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    });

    const afterLoginRoute = (currentUser) => {
        if (currentUser?.role === 'superadmin') return '/superadmin';
        if (currentUser?.role === 'orgadmin' && currentUser?.billing?.billing_locked) return '/payment';
        return '/';
    };

    const onSubmit = async (data) => {
        try {
            await login(data.email, data.password);
            const currentUser = useAuthStore.getState().user;
            navigate(afterLoginRoute(currentUser));
        } catch (e) {
            setError(e.response?.data?.error || 'Login failed');
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await verifySSO('google', credentialResponse.credential);
            const currentUser = useAuthStore.getState().user;
            navigate(afterLoginRoute(currentUser));
        } catch (e) {
            setError(e.response?.data?.error || 'Google Login failed');
        }
    };

    return (
        <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
            {/* Left Image Section */}
            <div className="hidden lg:flex flex-col justify-between p-12 text-white relative">
                <div
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{ backgroundImage: `url(${bgImage})` }}
                >
                    <div className="absolute inset-0 bg-black/20 z-10 mix-blend-overlay" />
                </div>
                <div className="relative z-20 flex items-center mb-10">
                    <img src={logoLight} alt="Source Code Kart Logo" className="h-16 md:h-20 w-auto drop-shadow-md" />
                </div>
                <div className="relative z-20 mt-auto pb-12">
                    <h1 className="text-4xl font-bold tracking-tight mb-4 drop-shadow-md">
                        Welcome Back
                    </h1>
                    <p className="text-lg text-white/90 max-w-md drop-shadow-md">
                        Access your dashboard to monitor performance, manage your team, and gain valuable productivity insights.
                    </p>
                </div>
            </div>

            {/* Right Form Section */}
            <div className="flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-background relative w-full">
                <div className="absolute inset-0 bg-muted/40 lg:hidden" />

                <Card className="w-full max-w-md relative z-10 shadow-xl border-border/60">
                    <CardHeader>
                        <CardTitle className="text-2xl">Login</CardTitle>
                        <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" {...register('email')} />
                                {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" {...register('password')} />
                                {errors.password && <span className="text-red-500 text-sm">{errors.password.message}</span>}
                            </div>
                            {error && <div className="text-red-500 text-sm">{error}</div>}
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Logging in...' : 'Login'}
                            </Button>
                            <div className="text-center">
                                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                                    Forgot your password?
                                </Link>
                            </div>
                        </form>

                        {Object.values(ssoStatus).some(Boolean) && (
                            <div className="mt-6 flex flex-col items-center">
                                <div className="relative w-full mb-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-muted-foreground/20" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                                    </div>
                                </div>

                                {ssoStatus.google && (
                                    <div className="w-full flex justify-center mb-3">
                                        <GoogleLogin
                                            onSuccess={handleGoogleSuccess}
                                            onError={() => setError('Google Login Failed')}
                                            useOneTap
                                            width="340"
                                        />
                                    </div>
                                )}

                                {ssoStatus.microsoft && (
                                    <div className="w-full flex justify-center mb-3">
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="w-[340px] max-w-full relative flex items-center justify-center font-normal text-[14px] text-gray-600 bg-white hover:bg-gray-50 h-[40px] shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border-[#dadce0]"
                                            onClick={() => toast.info('Microsoft SSO is enabled but requires backend configuration.')}
                                        >
                                            <div className="absolute left-3 flex items-center justify-center">
                                                <FaMicrosoft className="text-[#00a4ef] w-4 h-4" />
                                            </div>
                                            Sign in with Microsoft
                                        </Button>
                                    </div>
                                )}

                                {ssoStatus.apple && (
                                    <div className="w-full flex justify-center mb-3">
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="w-[340px] max-w-full relative flex items-center justify-center font-medium text-[14px] text-black bg-white hover:bg-gray-50 h-[40px] shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border-black"
                                            onClick={() => toast.info('Apple SSO is enabled but requires backend configuration.')}
                                        >
                                            <div className="absolute left-3 flex items-center justify-center">
                                                <FaApple className="w-[18px] h-[18px]" />
                                            </div>
                                            Sign in with Apple
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <p className="text-sm text-gray-500">
                            Don't have an organization? <Link to="/register" className="text-primary hover:underline">Register here</Link>
                        </p>
                    </CardFooter>
                </Card>

                <div className="absolute bottom-6 w-full text-center text-sm text-muted-foreground z-10">
                    copyright 2026 preqservices.com
                </div>
            </div>
        </div>
    );
}
