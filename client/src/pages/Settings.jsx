import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        name: '',
        max_users_limit: 0,
        timezone: 'UTC',
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
            setSettings(data);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            alert('Failed to load settings');
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

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.patch('/org/settings', {
                features: settings.features,
                timezone: settings.timezone
            });
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
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
