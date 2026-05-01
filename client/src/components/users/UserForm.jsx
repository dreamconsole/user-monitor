import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getBrowserTimezone } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import UserSearchSelect from '@/components/UserSearchSelect';

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const createSchema = z.object({
    name: z.string().min(2, "Full name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(['orgadmin', 'manager', 'user']),
    team_id: z.string().optional(),
    timezone: z.string().min(1, "Timezone is required"),
    emp_id: z.string().min(1, "Employee ID is required"),
    payroll_id: z.string().optional(),
    site: z.string().optional(),
    shift_start_time: z.string().nullable().optional(),
    shift_end_time: z.string().nullable().optional(),
    work_days: z.any().nullable().optional(),
});

const updateSchema = z.object({
    name: z.string().min(2, "Full name is required"),
    role: z.enum(['orgadmin', 'manager', 'user']),
    status: z.enum(['active', 'suspended']),
    team_id: z.string().optional(),
    timezone: z.string().optional(),
    emp_id: z.string().min(1, "Employee ID is required"),
    payroll_id: z.string().optional(),
    site: z.string().optional(),
    force_logout: z.boolean().optional(),
    shift_start_time: z.string().nullable().optional(),
    shift_end_time: z.string().nullable().optional(),
    work_days: z.any().nullable().optional(),
});

export default function UserForm({ user, onSubmit, isSubmitting }) {
    const isEdit = !!user;
    const schema = isEdit ? updateSchema : createSchema;

    const [teams, setTeams] = useState([]);
    const [features, setFeatures] = useState(null);
    const [defaults, setDefaults] = useState(null);
    const [showPasswordField, setShowPasswordField] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [masterFeatureOverride, setMasterFeatureOverride] = useState(false);
    const [overrides, setOverrides] = useState({
        shift_start_time: false,
        work_days: false
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: teamsData } = await api.get('/teams');
                setTeams(teamsData);

                if (isEdit) {
                    const { data: featureData } = await api.get(`/users/${user.id}/features`);
                    setDefaults(featureData.defaults);

                    if (featureData.overrides) {
                        setFeatures(featureData.overrides);
                        const hasFeatureOverrides = ['is_screenshots_enabled', 'is_afk_tracking_enabled', 'is_breaks_enabled', 'screenshot_interval_seconds', 'afk_threshold_seconds']
                            .some(key => featureData.overrides[key] !== null);
                        setMasterFeatureOverride(hasFeatureOverrides);
                    } else {
                        // Initialize with nulls but show defaults
                        setFeatures({
                            is_screenshots_enabled: null,
                            is_afk_tracking_enabled: null,
                            is_breaks_enabled: null,
                            screenshot_interval_seconds: null,
                            afk_threshold_seconds: null,
                        });
                        setMasterFeatureOverride(false);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            }
        };
        fetchData();
    }, [user, isEdit]);

    const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
            role: 'user',
            status: 'active',
            team_id: '',
            timezone: getBrowserTimezone(),
            emp_id: '',
            payroll_id: '',
            site: '',
            force_logout: false,
            shift_start_time: null,
            shift_end_time: null,
            work_days: null
        }
    });

    const roleWatch = watch('role');
    const workDaysWatch = watch('work_days');
    const teamIdWatch = watch('team_id');

    useEffect(() => {
        if (user) {
            // Reset the form in one shot so controlled Selects
            // reliably reflect existing values when editing.
            reset({
                name: user.name || '',
                email: user.email || '',
                password: '',
                role: user.role || 'user',
                status: user.status || 'active',
                team_id: user.team_id ? String(user.team_id) : '',
                timezone: user.timezone || getBrowserTimezone(),
                emp_id: user.emp_id || '',
                payroll_id: user.payroll_id || '',
                site: user.site || '',
                force_logout: !!user.force_logout,
                shift_start_time: user.shift_start_time || null,
                shift_end_time: user.shift_end_time || null,
                work_days: user.work_days || null
            });

            setOverrides({
                shift_start_time: !!user.shift_start_time,
                work_days: !!user.work_days
            });
        } else {
            reset({
                name: '',
                email: '',
                password: '',
                role: 'user',
                status: 'active',
                team_id: '',
                timezone: getBrowserTimezone(),
                emp_id: '',
                payroll_id: '',
                site: '',
                force_logout: false,
                shift_start_time: null,
                shift_end_time: null,
                work_days: null
            });
        }
    }, [user, reset]);

    // Teams load async; Radix Select won't render a label until the matching SelectItem exists.
    // Once teams arrive, re-apply the current user's team_id so the trigger shows the selection.
    useEffect(() => {
        if (!isEdit || !user?.team_id) return;
        if (!teams.length) return;
        const teamId = String(user.team_id);
        if (teamIdWatch !== teamId) {
            setValue('team_id', teamId, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
        }
    }, [isEdit, user?.team_id, teams.length, teamIdWatch, setValue]);

    const handleFormSubmit = async (data) => {
        // Prepare features data if edited
        let finalFeatures = null;
        if (isEdit && features) {
            if (masterFeatureOverride) {
                finalFeatures = {
                    is_screenshots_enabled: features.is_screenshots_enabled,
                    is_afk_tracking_enabled: features.is_afk_tracking_enabled,
                    is_breaks_enabled: features.is_breaks_enabled,
                    screenshot_interval_seconds: features.screenshot_interval_seconds,
                    afk_threshold_seconds: features.afk_threshold_seconds,
                };
            } else {
                finalFeatures = {
                    is_screenshots_enabled: null,
                    is_afk_tracking_enabled: null,
                    is_breaks_enabled: null,
                    screenshot_interval_seconds: null,
                    afk_threshold_seconds: null,
                };
            }
        }

        const finalData = {
            ...data,
            team_id: data.team_id || null,
            // Explicitly set shift settings to null if overrides are off
            shift_start_time: overrides.shift_start_time ? data.shift_start_time : null,
            shift_end_time: overrides.shift_start_time ? data.shift_end_time : null,
            work_days: overrides.work_days ? JSON.stringify(data.work_days) : null
        };

        // Pass both user data and features to the parent onSubmit
        await onSubmit(finalData, finalFeatures);

        // If a new password was entered, also reset the password
        if (isEdit && newPassword && newPassword.length >= 6) {
            try {
                await api.post(`/users/${user.id}/reset-password`, { newPassword });
                toast.success('Password changed successfully');
                setNewPassword('');
                setShowPasswordField(false);
            } catch (err) {
                toast.error(err.response?.data?.error || 'Failed to reset password');
            }
        }
    };

    const toggleShiftOverride = (key) => {
        const isEnabled = !overrides[key];
        setOverrides(prev => ({ ...prev, [key]: isEnabled }));
        if (isEnabled) {
            if (key === 'shift_start_time') {
                setValue('shift_start_time', defaults?.shift_start_time || '09:00');
                setValue('shift_end_time', defaults?.shift_end_time || '18:00');
            } else if (key === 'work_days') {
                setValue('work_days', defaults?.work_days || ["Mon", "Tue", "Wed", "Thu", "Fri"]);
            }
        } else {
            setValue(key, null);
            if (key === 'shift_start_time') setValue('shift_end_time', null);
        }
    };

    const toggleWorkDay = (day) => {
        const current = workDaysWatch || [];
        if (current.includes(day)) {
            setValue('work_days', current.filter(d => d !== day));
        } else {
            setValue('work_days', [...current, day]);
        }
    };

    const toggleMasterFeatureOverride = (checked) => {
        setMasterFeatureOverride(checked);
        if (checked && features && Object.values(features).every(v => v === null)) {
            // Populate features with defaults so they have something to edit
            setFeatures({
                is_screenshots_enabled: defaults?.is_screenshots_enabled ?? false,
                is_afk_tracking_enabled: defaults?.is_afk_tracking_enabled ?? false,
                is_breaks_enabled: defaults?.is_breaks_enabled ?? false,
                screenshot_interval_seconds: defaults?.screenshot_interval_seconds ?? 600,
                afk_threshold_seconds: defaults?.afk_threshold_seconds ?? 600,
            });
        }
    };

    const updateFeature = (key, value) => {
        setFeatures(prev => ({ ...prev, [key]: value }));
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 py-4 h-[85vh] overflow-y-auto px-1 pr-3">
            <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</h3>
                <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" {...register('name')} placeholder="John Doe" />
                    {errors.name && <span className="text-destructive text-sm">{errors.name.message}</span>}
                </div>

                {!isEdit && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" {...register('email')} placeholder="john@example.com" />
                            {errors.email && <span className="text-destructive text-sm">{errors.email.message}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" {...register('password')} />
                            {errors.password && <span className="text-destructive text-sm">{errors.password.message}</span>}
                        </div>
                    </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select onValueChange={(val) => setValue('role', val)} value={watch('role')}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="orgadmin">Org Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.role && <span className="text-destructive text-sm">{errors.role.message}</span>}
                    </div>

                    {isEdit && (
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select onValueChange={(val) => setValue('status', val)} value={watch('status')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {roleWatch !== 'orgadmin' && (
                    <div className="space-y-2">
                        <Label>Team (Required)</Label>
                        <Select
                            key={`${teamIdWatch || 'none'}-${teams.length}`}
                            onValueChange={(val) => setValue('team_id', val)}
                            value={teamIdWatch}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.team_id && <span className="text-destructive text-sm">{errors.team_id.message}</span>}
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select onValueChange={(val) => setValue('timezone', val)} value={watch('timezone')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {Intl.supportedValuesOf('timeZone').map(tz => (
                                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.timezone && <span className="text-destructive text-sm">{errors.timezone.message}</span>}
                </div>

                <Separator className="my-6" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agent Configuration</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="emp_id">Employee ID (Mandatory)</Label>
                        <Input id="emp_id" {...register('emp_id')} placeholder="EMP001" />
                        {errors.emp_id && <span className="text-destructive text-sm">{errors.emp_id.message}</span>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="payroll_id">Payroll ID (Optional)</Label>
                        <Input id="payroll_id" {...register('payroll_id')} placeholder="PAY-X12" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="site">Work Site / Location</Label>
                    <Input id="site" {...register('site')} placeholder="New York Office" />
                </div>

                {isEdit && (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-destructive/5 border-destructive/20">
                        <div className="space-y-0.5">
                            <Label className="text-destructive font-semibold">Force Logout</Label>
                            <p className="text-xs text-muted-foreground italic">Agent will disconnect on next heartbeat.</p>
                        </div>
                        <Switch
                            checked={watch('force_logout')}
                            onCheckedChange={(val) => setValue('force_logout', val)}
                        />
                    </div>
                )}

                {isEdit && (
                    <>
                        <Separator className="my-6" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Password Management</h3>
                        {!showPasswordField ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full gap-2"
                                onClick={() => setShowPasswordField(true)}
                            >
                                <KeyRound className="h-4 w-4" />
                                Change Password
                            </Button>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    placeholder="Min 6 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoFocus
                                />
                                {newPassword && newPassword.length < 6 && (
                                    <span className="text-destructive text-sm">Password must be at least 6 characters</span>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Shift Configuration Section */}
                {isEdit && defaults && (
                    <>
                        <Separator className="my-6" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shift Configuration</h3>

                        <div className="space-y-4">
                            {/* Shift Times */}
                            <Card className="border-none bg-muted/30">
                                <CardContent className="pt-4 space-y-3 font-normal">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-0.5">
                                            <Label className="text-sm">Shift Time</Label>
                                            <span className="text-[10px] text-muted-foreground">Org Default: {defaults.shift_start_time} - {defaults.shift_end_time}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={overrides.shift_start_time}
                                                onCheckedChange={() => toggleShiftOverride('shift_start_time')}
                                            />
                                            <Label className="text-xs text-muted-foreground">Override</Label>
                                        </div>
                                    </div>

                                    {overrides.shift_start_time && (
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Start Time</Label>
                                                <Input type="time" {...register('shift_start_time')} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">End Time</Label>
                                                <Input type="time" {...register('shift_end_time')} />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Work Days */}
                            <Card className="border-none bg-muted/30">
                                <CardContent className="pt-4 space-y-3 font-normal">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-0.5">
                                            <Label className="text-sm">Working Days</Label>
                                            <span className="text-[10px] text-muted-foreground">Org Default: {Array.isArray(defaults.work_days) ? defaults.work_days.join(', ') : 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={overrides.work_days}
                                                onCheckedChange={() => toggleShiftOverride('work_days')}
                                            />
                                            <Label className="text-xs text-muted-foreground">Override</Label>
                                        </div>
                                    </div>

                                    {overrides.work_days && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {DAYS_OF_WEEK.map(day => {
                                                const isSelected = workDaysWatch?.includes(day);
                                                return (
                                                    <Badge
                                                        key={day}
                                                        variant={isSelected ? "default" : "outline"}
                                                        className="cursor-pointer px-3 py-1 text-xs select-none hover:bg-primary/90 transition-colors"
                                                        onClick={() => toggleWorkDay(day)}
                                                    >
                                                        {day}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}

                {isEdit && user.device_id && (
                    <>
                        <Separator className="my-6" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tracking Information</h3>
                        <Card className="border-none bg-muted/50">
                            <CardContent className="p-4 space-y-4 text-sm">
                                <div className="grid grid-cols-2 gap-y-2">
                                    <span className="text-muted-foreground">Device ID</span>
                                    <span className="font-mono text-xs truncate bg-background p-1 rounded border">{user.device_id}</span>

                                    <span className="text-muted-foreground">Agent Version</span>
                                    <span className="font-medium">{user.agent_version || 'N/A'}</span>

                                    <span className="text-muted-foreground">Auto-Login Token</span>
                                    <span className="font-mono text-xs truncate opacity-50">
                                        {user.token ? `${user.token.substring(0, 10)}****************` : 'Not Set'}
                                    </span>

                                    <span className="text-muted-foreground">Last Heartbeat</span>
                                    <span className="font-medium text-primary">
                                        {user.last_heartbeat ? new Date(user.last_heartbeat).toLocaleString() : 'Never'}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {isEdit && defaults && (
                    <>
                        <Separator className="my-6" />
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Feature Overrides</h3>
                                <p className="text-xs text-muted-foreground italic">Use custom settings for this user.</p>
                            </div>
                            <Switch
                                checked={masterFeatureOverride}
                                onCheckedChange={toggleMasterFeatureOverride}
                            />
                        </div>

                        {masterFeatureOverride && (
                            <div className="space-y-4">
                                {/* Screenshots Override */}
                                <Card className="border-none bg-muted/30">
                                    <CardContent className="pt-4 space-y-3 font-normal">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <Label className="text-sm">Enable Screenshots</Label>
                                            </div>
                                            <Switch
                                                checked={features.is_screenshots_enabled ?? false}
                                                onCheckedChange={(val) => updateFeature('is_screenshots_enabled', val)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/10">
                                            <div className="flex flex-col gap-0.5">
                                                <Label className="text-sm">Screenshot Interval</Label>
                                            </div>
                                            <Select
                                                value={String(features.screenshot_interval_seconds || defaults.screenshot_interval_seconds)}
                                                onValueChange={(v) => updateFeature('screenshot_interval_seconds', parseInt(v))}
                                            >
                                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="60">1m</SelectItem>
                                                    <SelectItem value="300">5m</SelectItem>
                                                    <SelectItem value="600">10m</SelectItem>
                                                    <SelectItem value="900">15m</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* AFK Override */}
                                <Card className="border-none bg-muted/30">
                                    <CardContent className="pt-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <Label className="text-sm">AFK Tracking</Label>
                                            </div>
                                            <Switch
                                                checked={features.is_afk_tracking_enabled ?? false}
                                                onCheckedChange={(val) => updateFeature('is_afk_tracking_enabled', val)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/10">
                                            <div className="flex flex-col gap-0.5">
                                                <Label className="text-sm">Idle Threshold</Label>
                                            </div>
                                            <Select
                                                value={String(features.afk_threshold_seconds || defaults.afk_threshold_seconds)}
                                                onValueChange={(v) => updateFeature('afk_threshold_seconds', parseInt(v))}
                                            >
                                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="60">1m</SelectItem>
                                                    <SelectItem value="300">5m</SelectItem>
                                                    <SelectItem value="600">10m</SelectItem>
                                                    <SelectItem value="1800">30m</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Breaks Override */}
                                <Card className="border-none bg-muted/30">
                                    <CardContent className="pt-4 flex items-center justify-between font-normal">
                                        <div className="flex flex-col gap-0.5">
                                            <Label className="text-sm">Enable Breaks</Label>
                                        </div>
                                        <Switch
                                            checked={features.is_breaks_enabled ?? false}
                                            onCheckedChange={(val) => updateFeature('is_breaks_enabled', val)}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="pt-6 flex justify-end gap-3 sticky bottom-0 bg-background pb-2">
                <Button type="submit" disabled={isSubmitting}>
                    {isEdit ? 'Update User' : 'Create User'}
                </Button>
            </div>
        </form>
    );
}
