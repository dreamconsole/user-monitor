import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';
import SuperAdminBillingSettings from '@/components/superadmin/SuperAdminBillingSettings';

/** Settings edited on a dedicated card — skip in the generic list. */
const HIDDEN_SETTING_KEYS = new Set(['billing_manual_payment']);

function settingDisplayValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.replace(/^"|"$/g, '');
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export default function SuperAdminSettings() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const settingsRes = await api.get('/superadmin/settings');
            setSettings(settingsRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load global settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleSetting = async (key, currentValue) => {
        try {
            await api.put('/superadmin/settings', {
                settings: [{ key, value: !currentValue }]
            });
            setSettings(prev => ({
                ...prev,
                [key]: { ...prev[key], value: !currentValue }
            }));
            toast.success(`Updated ${key} successfully`);
        } catch (error) {
            toast.error('Failed to update setting');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Global Settings</h2>
                <p className="text-muted-foreground mt-2">System-wide configurations applicable to all users and organizations.</p>
            </div>

            <SuperAdminBillingSettings />

            <Card>
                <CardHeader>
                    <CardTitle>Configuration Flags</CardTitle>
                    <CardDescription>Toggle SSO providers and manage version control directly from here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {Object.entries(settings)
                        .filter(([key]) => !HIDDEN_SETTING_KEYS.has(key))
                        .map(([key, item]) => {
                        const isBool = typeof item.value === 'boolean';
                        return (
                        <div key={key} className="flex flex-row items-center justify-between rounded-lg border p-4 bg-card hover:bg-muted/50 transition-colors">
                            <div className="space-y-0.5">
                                <div className="text-base font-semibold">{key}</div>
                                <div className="text-sm text-muted-foreground">{item?.description || ''}</div>
                            </div>
                            <div>
                                {isBool ? (
                                    <Switch
                                        checked={item.value}
                                        onCheckedChange={() => toggleSetting(key, item.value)}
                                        className="data-[state=checked]:bg-primary"
                                    />
                                ) : (
                                    <Input
                                        type="text"
                                        defaultValue={settingDisplayValue(item.value)}
                                        className="w-48 font-mono border-slate-300"
                                        onBlur={async (e) => {
                                            const val = e.target.value;
                                            try {
                                                await api.put('/superadmin/settings', {
                                                    settings: [{ key, value: val }]
                                                });
                                                toast.success(`Updated ${key} successfully`);
                                            } catch (err) {
                                                toast.error('Failed to update setting');
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    );})}
                    {Object.keys(settings).filter((k) => !HIDDEN_SETTING_KEYS.has(k)).length === 0 && (
                        <div className="text-center text-muted-foreground py-8">No global settings found.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
