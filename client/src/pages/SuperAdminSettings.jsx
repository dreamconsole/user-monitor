import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

const AGENT_KEYS = [
    'agent_latest_version',
    'agent_windows_download_url',
    'agent_windows_download_url_msi',
    'agent_update_release_notes'
];

const SETTING_TITLE = {
    sso_google_enabled: 'Google SSO',
    sso_microsoft_enabled: 'Microsoft SSO',
    sso_apple_enabled: 'Apple SSO',
    agent_latest_version: 'Agent latest version (semver)',
    agent_windows_download_url: 'Windows installer URL (.exe)',
    agent_windows_download_url_msi: 'Windows MSI URL (optional)',
    agent_update_release_notes: 'Agent release notes (optional)'
};

function displayTitle(key) {
    return SETTING_TITLE[key] || key;
}

function stringifySettingValue(val) {
    if (val == null) return '';
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val;
    return String(val);
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

    const persistSetting = async (key, value) => {
        try {
            await api.put('/superadmin/settings', {
                settings: [{ key, value }]
            });
            setSettings((prev) => ({
                ...prev,
                [key]: { ...prev[key], value }
            }));
            toast.success(`Updated ${displayTitle(key)}`);
        } catch {
            toast.error('Failed to update setting');
        }
    };

    const toggleSetting = (key, currentValue) => {
        persistSetting(key, !currentValue);
    };

    const renderStringControl = (key, item, opts = {}) => {
        const { wide, multiline } = opts;
        const raw = stringifySettingValue(item.value);
        const displayVal =
            typeof raw === 'string' ? raw.replace(/^"|"$/g, '') : raw;

        if (multiline) {
            return (
                <Textarea
                    defaultValue={displayVal}
                    className="min-h-[88px] w-full max-w-2xl font-mono text-sm"
                    placeholder="Optional notes for agent updates"
                    onBlur={(e) => {
                        persistSetting(key, e.target.value);
                    }}
                />
            );
        }

        return (
            <Input
                type="text"
                defaultValue={displayVal}
                className={
                    wide
                        ? 'w-full max-w-2xl font-mono text-sm border-slate-300'
                        : 'w-48 font-mono border-slate-300'
                }
                placeholder={key.includes('url') ? 'https://…' : ''}
                onBlur={(e) => {
                    persistSetting(key, e.target.value);
                }}
            />
        );
    };

    if (loading) return <div>Loading...</div>;

    const agentSet = new Set(AGENT_KEYS);
    const agentEntries = AGENT_KEYS.filter((k) => settings[k]).map((k) => [k, settings[k]]);
    const otherEntries = Object.entries(settings)
        .filter(([k]) => !agentSet.has(k))
        .sort(([a], [b]) => a.localeCompare(b));

    const renderRow = (key, item) => (
        <div
            key={key}
            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-lg border p-4 bg-card hover:bg-muted/50 transition-colors"
        >
            <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-base font-semibold">{displayTitle(key)}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
            </div>
            <div className="shrink-0 w-full sm:w-auto sm:max-w-[min(100%,42rem)]">
                {typeof item.value === 'boolean' ? (
                    <Switch
                        checked={item.value}
                        onCheckedChange={() => toggleSetting(key, item.value)}
                        className="data-[state=checked]:bg-primary"
                    />
                ) : key === 'agent_update_release_notes' ? (
                    renderStringControl(key, item, { multiline: true })
                ) : (
                    renderStringControl(key, item, { wide: agentSet.has(key) })
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Global Settings</h2>
                <p className="text-muted-foreground mt-2">
                    System-wide configurations. Desktop agent updates are stored in the database and served at{' '}
                    <code className="text-xs bg-muted px-1 rounded">GET /agent/update-info</code>.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Desktop agent (Windows)</CardTitle>
                    <CardDescription>
                        Latest semver and HTTPS URLs for installers. Both <strong>Agent latest version</strong> and{' '}
                        <strong>Windows installer URL</strong> must be set for agents to see an update.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {agentEntries.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No agent settings found. Run server migration <code className="text-xs">013_agent_update_global_settings</code>.
                        </p>
                    )}
                    {agentEntries.map(([key, item]) => renderRow(key, item))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Configuration flags</CardTitle>
                    <CardDescription>SSO and other toggles.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {otherEntries.map(([key, item]) => renderRow(key, item))}
                    {otherEntries.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">No additional settings.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
