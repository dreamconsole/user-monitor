import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        name: '',
        max_users_limit: 0,
        timezone: 'UTC',
        shift_start_time: '09:00',
        shift_end_time: '18:00',
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
        }
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/org/settings');
            // Ensure defaults if null
            setSettings({
                ...data,
                shift_start_time: data.shift_start_time || '09:00',
                shift_end_time: data.shift_end_time || '18:00',
                shift_duration: data.shift_duration || 9.00,
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

    const calculateDuration = (start, end) => {
        if (!start || !end) return 0;
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        let duration = (endH + endM / 60) - (startH + startM / 60);
        if (duration < 0) duration += 24; // Handle overnight
        return parseFloat(duration.toFixed(2));
    };

    const handleShiftChange = (key, value) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            if (key === 'shift_start_time' || key === 'shift_end_time') {
                newSettings.shift_duration = calculateDuration(
                    key === 'shift_start_time' ? value : prev.shift_start_time,
                    key === 'shift_end_time' ? value : prev.shift_end_time
                );
            }
            return newSettings;
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
                shift_duration: settings.shift_duration,
                work_days: JSON.stringify(settings.work_days),
                start_of_day: settings.start_of_day,
                primary_color_light: settings.primary_color_light,
                primary_color_dark: settings.primary_color_dark
            });
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
                                onChange={(e) => handleShiftChange('shift_start_time', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Shift End Time</Label>
                            <Input
                                type="time"
                                value={settings.shift_end_time}
                                onChange={(e) => handleShiftChange('shift_end_time', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Calculated Duration (Hours)</Label>
                            <Input
                                type="number"
                                value={settings.shift_duration}
                                readOnly
                                className="bg-muted"
                            />
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
                            <Label>Start of the Day</Label>
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

                    {/* Breaks */}
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
