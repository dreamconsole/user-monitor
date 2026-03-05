import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useNavigate, Link } from 'react-router-dom';
import bgImage from '@/assets/login_bg.png';
import logoLight from '@/assets/logo-light.png';

const schema = z.object({
    orgName: z.string().min(2, "Organization name is required"),
    websiteUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
    employeeCount: z.string().min(1, "Please select employee count"),
    country: z.string().min(2, "Country is required"),
    industry: z.string().min(2, "Industry is required"),
    timezone: z.string().min(1, "Timezone is required"),
    userName: z.string().min(2, "User name is required"),
    email: z.string().email(),
    password: z.string().min(6),
});

export default function Register() {
    const { registerOrg } = useAuthStore();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data) => {
        try {
            await registerOrg(data);
            navigate('/');
        } catch (e) {
            setError(e.response?.data?.error || 'Registration failed');
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
                        Let's Get Started
                    </h1>
                    <p className="text-lg text-white/90 max-w-md drop-shadow-md">
                        Create your organization profile and begin managing your company effortlessly.
                    </p>
                </div>
            </div>

            {/* Right Form Section */}
            <div className="flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-background relative w-full">
                <div className="absolute inset-0 bg-muted/40 lg:hidden" />

                <Card className="w-full max-w-2xl relative z-10 shadow-xl border-border/60">
                    <CardHeader>
                        <CardTitle className="text-2xl">Create Organization</CardTitle>
                        <CardDescription>Register your company and admin account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="orgName">Organization Name</Label>
                                    <Input id="orgName" {...register('orgName')} placeholder="Acme Corp" />
                                    {errors.orgName && <span className="text-red-500 text-sm">{errors.orgName.message}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="websiteUrl">Website URL</Label>
                                    <Input id="websiteUrl" {...register('websiteUrl')} placeholder="https://acme.com" />
                                    {errors.websiteUrl && <span className="text-red-500 text-sm">{errors.websiteUrl.message}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="employeeCount">Employee Count</Label>
                                    <select id="employeeCount" {...register('employeeCount')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        <option value="">Select range</option>
                                        <option value="1-10">1-10</option>
                                        <option value="11-50">11-50</option>
                                        <option value="51-200">51-200</option>
                                        <option value="201-500">201-500</option>
                                        <option value="500+">500+</option>
                                    </select>
                                    {errors.employeeCount && <span className="text-red-500 text-sm">{errors.employeeCount.message}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="industry">Industry</Label>
                                    <Input id="industry" {...register('industry')} placeholder="Technology" />
                                    {errors.industry && <span className="text-red-500 text-sm">{errors.industry.message}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input id="country" {...register('country')} placeholder="United States" />
                                    {errors.country && <span className="text-red-500 text-sm">{errors.country.message}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="timezone">Timezone</Label>
                                    <Input id="timezone" {...register('timezone')} placeholder="America/New_York" />
                                    {errors.timezone && <span className="text-red-500 text-sm">{errors.timezone.message}</span>}
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h3 className="font-medium mb-4">Admin Account</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="userName">Full Name</Label>
                                        <Input id="userName" {...register('userName')} placeholder="John Doe" />
                                        {errors.userName && <span className="text-red-500 text-sm">{errors.userName.message}</span>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" {...register('email')} placeholder="john@example.com" />
                                        {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input id="password" type="password" {...register('password')} />
                                        {errors.password && <span className="text-red-500 text-sm">{errors.password.message}</span>}
                                    </div>
                                </div>
                            </div>

                            {error && <div className="text-red-500 text-sm">{error}</div>}
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating account...' : 'Get Started'}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <p className="text-sm text-muted-foreground">
                            Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
                        </p>
                    </CardFooter>
                </Card>

                <div className="absolute bottom-6 w-full text-center text-sm text-muted-foreground z-10">
                    copyright 2026 sourcecodekart.com
                </div>
            </div>
        </div>
    );
}
