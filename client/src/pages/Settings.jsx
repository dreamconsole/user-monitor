import { useState, useEffect } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** DB DECIMAL/NUMERIC often arrive as strings (e.g. "9.00"); SelectItem values are "9". */
const hoursSelectValue = (v, fallback = 9) => {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return String(n);
    return String(fallback);
};

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const [settings, setSettings] = useState({
        name: '',
        max_users_limit: 0,
        timezone: 'UTC',
        shift_start_time: '09:00',
        shift_end_time: '18:00',
        org_working_hours: 9.00,
        shift_duration: 9.00,
        work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        start_of_day: '00:00',
        primary_color_light: '#0f172a',
        primary_color_dark: '#f8fafc',
        features: {
            is_activity_tracking_enabled: true,
            is_screenshots_enabled: true,
            screenshot_interval_seconds: 300,
            is_afk_tracking_enabled: true,
            afk_threshold_seconds: 300,
            is_breaks_enabled: true,
            is_force_logout_enabled: true,
            is_campaigns_enabled: false,
        }
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSubscription = async () => {
        try {
            const { data } = await api.get('/org/subscription');
            setSubscription(data);
        } catch (error) {
            console.error('Failed to fetch subscription:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/org/settings');
            // Ensure defaults if null
            const ow = parseFloat(data.org_working_hours);
            const sd = parseFloat(data.shift_duration);
            setSettings({
                ...data,
                shift_start_time: data.shift_start_time || '09:00',
                shift_end_time: data.shift_end_time || '18:00',
                org_working_hours: Number.isFinite(ow) ? ow : 9,
                shift_duration: Number.isFinite(sd) ? sd : 9,
                work_days: data.work_days || ["Mon", "Tue", "Wed", "Thu", "Fri"],
                start_of_day: data.start_of_day || '00:00',
                primary_color_light: data.primary_color_light || '#0f172a',
                primary_color_dark: data.primary_color_dark || '#f8fafc'
            });
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
        fetchSubscription();
    };

    const handleToggle = (key) => {
        setSettings(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [key]: !prev.features[key]
            }
        }));
    };

    const handleSelectChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [key]: parseInt(value)
            }
        }));
    };

    const handleShiftDurationChange = (value) => {
        setSettings(prev => {
            const numValue = parseFloat(value);
            const [startH, startM] = prev.shift_start_time.split(':').map(Number);
            let endH = startH + Math.floor(numValue);
            let endM = startM + ((numValue % 1) * 60);

            if (endM >= 60) {
                endH += Math.floor(endM / 60);
                endM = endM % 60;
            }

            endH = endH % 24;

            const shift_end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

            return {
                ...prev,
                org_working_hours: numValue,
                shift_end_time
            };
        });
    };

    const handleShiftStartChange = (value) => {
        setSettings(prev => {
            const numValue = prev.org_working_hours;
            const [startH, startM] = value.split(':').map(Number);
            let endH = startH + Math.floor(numValue);
            let endM = startM + ((numValue % 1) * 60);

            if (endM >= 60) {
                endH += Math.floor(endM / 60);
                endM = endM % 60;
            }

            endH = endH % 24;

            const shift_end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

            return {
                ...prev,
                shift_start_time: value,
                shift_end_time
            };
        });
    };

    const toggleDay = (day) => {
        setSettings(prev => {
            const currentDays = prev.work_days || [];
            if (currentDays.includes(day)) {
                return { ...prev, work_days: currentDays.filter(d => d !== day) };
            } else {
                return { ...prev, work_days: [...currentDays, day] };
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.patch('/org/settings', {
                features: settings.features,
                timezone: settings.timezone,
                shift_start_time: settings.shift_start_time,
                shift_end_time: settings.shift_end_time,
                org_working_hours: settings.org_working_hours,
                shift_duration: settings.shift_duration,
                work_days: JSON.stringify(settings.work_days),
                start_of_day: settings.start_of_day,
                primary_color_light: settings.primary_color_light,
                primary_color_dark: settings.primary_color_dark
            });
            await useAuthStore.getState().refreshUser();
            toast.success('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <div>
                    <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-4 w-96 bg-muted animate-pulse rounded" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-card border rounded-lg p-6 space-y-4">
                        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="flex justify-between items-center">
                                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                                    <div className="h-6 w-12 bg-muted animate-pulse rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6 h-[85vh] overflow-y-auto pr-4 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
                <p className="text-muted-foreground">Manage your organization-level monitoring preferences and limits.</p>
            </div>

            {subscription && (
                <Card className={!subscription.access?.valid ? 'border-destructive' : ''}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Subscription &amp; billing
                            {subscription.access?.valid ? (
                                <Badge>Active</Badge>
                            ) : (
                                <Badge variant="destructive">{subscription.access?.code || 'Inactive'}</Badge>
                            )}
                            {subscription.subscription_required === false && (
                                <Badge variant="secondary">Exempt</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {subscription.access?.valid
                                ? 'Your organization has access to monitoring features.'
                                : subscription.access?.reason || 'Contact your platform administrator to renew.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-medium capitalize">{subscription.subscription?.plan_id || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Seats (employees)</span>
                            <span className="font-medium">{subscription.seats_used} / {subscription.licensed_seats}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium capitalize">{subscription.subscription?.status || '—'}</span>
                        </div>
                        {subscription.subscription?.current_period_end && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Period ends</span>
                                <span className="font-medium">
                                    {format(parseISO(subscription.subscription.current_period_end), 'MMM d, yyyy')}
                                </span>
                            </div>
                        )}
                        {subscription.subscription?.trial_ends_at && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Trial ends</span>
                                <span className="font-medium">
                                    {format(parseISO(subscription.subscription.trial_ends_at), 'MMM d, yyyy')}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Organization Info</CardTitle>
                    <CardDescription>View your organization's general information and limits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Organization Name</Label>
                        <span className="font-medium">{settings.name}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <Label>Max Users (Read-only)</Label>
                        <span className="font-medium">{settings.max_users_limit}</span>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <Label>Organization Timezone</Label>
                        <Select
                            value={settings.timezone}
                            onValueChange={(v) => setSettings(prev => ({ ...prev, timezone: v }))}
                        >
                            <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {Intl.supportedValuesOf('timeZone').map(tz => (
                                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Default timezone for users and organization reporting.</p>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Light Mode Primary Color</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="color"
                                    className="w-14 h-10 p-1 rounded-sm"
                                    value={settings.primary_color_light}
                                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color_light: e.target.value }))}
                                />
                                <Badge style={{ backgroundColor: settings.primary_color_light, color: '#ffffff' }} variant="outline">
                                    Preview
                                </Badge>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Dark Mode Primary Color</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="color"
                                    className="w-14 h-10 p-1 rounded-sm"
                                    value={settings.primary_color_dark}
                                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color_dark: e.target.value }))}
                                />
                                <Badge style={{ backgroundColor: settings.primary_color_dark, color: '#0f172a' }} variant="outline">
                                    Preview
                                </Badge>
                            </div>
                        </div>
                    </div>

                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Shift Settings</CardTitle>
                    <CardDescription>Define default working hours and days for the organization.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>Shift Start Time</Label>
                            <Input
                                type="time"
                                value={settings.shift_start_time}
                                onChange={(e) => handleShiftStartChange(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Org Working Hours</Label>
                            <Select
                                value={hoursSelectValue(settings.org_working_hours)}
                                onValueChange={(v) => handleShiftDurationChange(v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select working hours" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="4">4 Hours</SelectItem>
                                    <SelectItem value="8">8 Hours</SelectItem>
                                    <SelectItem value="9">9 Hours</SelectItem>
                                    <SelectItem value="12">12 Hours</SelectItem>
                                    <SelectItem value="14">14 Hours</SelectItem>
                                    <SelectItem value="24">24 Hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Calculated End Time (Next Day if needed)</Label>
                            <Input
                                type="time"
                                value={settings.shift_end_time}
                                readOnly
                                className="bg-muted text-muted-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>User's Max Shift Duration</Label>
                            <Select
                                value={hoursSelectValue(settings.shift_duration)}
                                onValueChange={(v) => setSettings(prev => ({ ...prev, shift_duration: parseFloat(v) }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select user max hours" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="4">4 Hours</SelectItem>
                                    <SelectItem value="8">8 Hours</SelectItem>
                                    <SelectItem value="9">9 Hours</SelectItem>
                                    <SelectItem value="10">10 Hours</SelectItem>
                                    <SelectItem value="12">12 Hours</SelectItem>
                                    <SelectItem value="14">14 Hours</SelectItem>
                                    <SelectItem value="24">24 Hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Working Days</Label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map(day => {
                                const isSelected = settings.work_days?.includes(day);
                                return (
                                    <Badge
                                        key={day}
                                        variant={isSelected ? "default" : "outline"}
                                        className="cursor-pointer px-4 py-1.5 text-sm select-none hover:bg-primary/90 transition-colors"
                                        onClick={() => toggleDay(day)}
                                    >
                                        {day}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                Start of the Day
                                <span className="relative group flex items-center">
                                    <div className="flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground text-muted-foreground text-[10px] font-bold cursor-help">
                                        i
                                    </div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        Determines the 24-hour cutoff for daily reporting. For standard days, leave at 00:00 (Midnight). If your org handles heavy night shifts (e.g. 10PM-6AM), setting this to 06:00 means the "work day" resets at 6AM instead of midnight.
                                    </div>
                                </span>
                            </Label>
                            <Input
                                type="time"
                                value={settings.start_of_day}
                                onChange={(e) => setSettings(prev => ({ ...prev, start_of_day: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">Used for daily reporting cut-offs (e.g. 00:00 midnight).</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Monitoring Features</CardTitle>
                    <CardDescription>Control which monitoring features are enabled for your organization.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Activity Tracking */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Activity Tracking</Label>
                            <p className="text-sm text-muted-foreground text-sm">Log keyboard and mouse activity patterns.</p>
                        </div>
                        <Switch
                            checked={settings.features.is_activity_tracking_enabled}
                            onCheckedChange={() => handleToggle('is_activity_tracking_enabled')}
                        />
                    </div>
                    <Separator />

                    {/* Screenshots */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Enable Screenshots</Label>
                                <p className="text-sm text-muted-foreground">Automatically capture screenshots during work sessions.</p>
                            </div>
                            <Switch
                                checked={settings.features.is_screenshots_enabled}
                                onCheckedChange={() => handleToggle('is_screenshots_enabled')}
                            />
                        </div>
                        {settings.features.is_screenshots_enabled && (
                            <div className="flex items-center justify-between pl-6 border-l-2">
                                <Label>Screenshot Interval</Label>
                                <Select
                                    value={settings.features.screenshot_interval_seconds.toString()}
                                    onValueChange={(v) => handleSelectChange('screenshot_interval_seconds', v)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select interval" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="60">1 Minute</SelectItem>
                                        <SelectItem value="180">3 Minutes</SelectItem>
                                        <SelectItem value="300">5 Minutes</SelectItem>
                                        <SelectItem value="600">10 Minutes</SelectItem>
                                        <SelectItem value="900">15 Minutes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <Separator />

                    {/* AFK / Idle Tracking */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>AFK Tracking</Label>
                                <p className="text-sm text-muted-foreground">Detect when users are away from their keyboard.</p>
                            </div>
                            <Switch
                                checked={settings.features.is_afk_tracking_enabled}
                                onCheckedChange={() => handleToggle('is_afk_tracking_enabled')}
                            />
                        </div>
                        {settings.features.is_afk_tracking_enabled && (
                            <div className="flex items-center justify-between pl-6 border-l-2">
                                <Label>Idle Threshold</Label>
                                <Select
                                    value={settings.features.afk_threshold_seconds.toString()}
                                    onValueChange={(v) => handleSelectChange('afk_threshold_seconds', v)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select threshold" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="60">1 Minute</SelectItem>
                                        <SelectItem value="300">5 Minutes</SelectItem>
                                        <SelectItem value="600">10 Minutes</SelectItem>
                                        <SelectItem value="1200">20 Minutes</SelectItem>
                                        <SelectItem value="1800">30 Minutes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <Separator />

                    {/* Idle Action */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Action on Long Idle</Label>
                                <p className="text-sm text-muted-foreground">What the system should do if a user remains idle for a long time.</p>
                            </div>
                            <Select
                                value={settings.features.idle_action || 'none'}
                                onValueChange={(v) => setSettings(prev => ({ ...prev, features: { ...prev.features, idle_action: v } }))}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Take No Action</SelectItem>
                                    <SelectItem value="notification">Notify Manager</SelectItem>
                                    <SelectItem value="logout">Auto Logout User</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {settings.features.idle_action && settings.features.idle_action !== 'none' && (
                            <div className="flex items-center justify-between pl-6 border-l-2">
                                <Label>Idle Action Threshold</Label>
                                <Select
                                    value={(settings.features.idle_action_duration_minutes || 60).toString()}
                                    onValueChange={(v) => handleSelectChange('idle_action_duration_minutes', v)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select duration" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5 Minutes</SelectItem>
                                        <SelectItem value="15">15 Minutes</SelectItem>
                                        <SelectItem value="30">30 Minutes</SelectItem>
                                        <SelectItem value="45">45 Minutes</SelectItem>
                                        <SelectItem value="60">1 Hour</SelectItem>
                                        <SelectItem value="120">2 Hours</SelectItem>
                                        <SelectItem value="240">4 Hours</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <Separator />

                    {/* Breaks */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Enable Breaks</Label>
                                <p className="text-sm text-muted-foreground text-sm">Allow users to record breaks during shifts.</p>
                            </div>
                            <Switch
                                checked={settings.features.is_breaks_enabled}
                                onCheckedChange={() => handleToggle('is_breaks_enabled')}
                            />
                        </div>
                        {settings.features.is_breaks_enabled && (
                            <div className="flex items-center justify-between pl-6 border-l-2 mt-4">
                                <Label>Action on Break Limit Exceeded</Label>
                                <Select
                                    value={settings.features.break_exceeded_action || 'notification'}
                                    onValueChange={(v) => handleSelectChange('break_exceeded_action', v)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Take No Action</SelectItem>
                                        <SelectItem value="notification">Notify Manager</SelectItem>
                                        <SelectItem value="logout">Auto Logout User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <Separator />

                    {/* Campaigns */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Enable Campaigns</Label>
                            <p className="text-sm text-muted-foreground text-sm">Allow assigning campaigns to users and track campaign-specific work hours.</p>
                        </div>
                        <Switch
                            checked={settings.features.is_campaigns_enabled}
                            onCheckedChange={() => handleToggle('is_campaigns_enabled')}
                        />
                    </div>
                    <Separator />

                    {/* Force Logout */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Enable Force Logout</Label>
                            <p className="text-sm text-muted-foreground text-sm">Allow managers/admins to remotely end user shifts.</p>
                        </div>
                        <Switch
                            checked={settings.features.is_force_logout_enabled}
                            onCheckedChange={() => handleToggle('is_force_logout_enabled')}
                        />
                    </div>
                    <Separator />

                    {/* Heartbeat Interval */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Agent Heartbeat Interval</Label>
                            <p className="text-sm text-muted-foreground">Frequency at which the agent checks in with the server.</p>
                        </div>
                        <Select
                            value={(settings.features.heartbeat_interval_seconds || 300).toString()}
                            onValueChange={(v) => handleSelectChange('heartbeat_interval_seconds', v)}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select interval" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="60">1 Minute</SelectItem>
                                <SelectItem value="180">3 Minutes</SelectItem>
                                <SelectItem value="300">5 Minutes</SelectItem>
                                <SelectItem value="600">10 Minutes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}
