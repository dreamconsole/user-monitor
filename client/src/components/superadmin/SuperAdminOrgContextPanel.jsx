import { useState, useEffect } from 'react';
import api from '@/lib/api';
import useSuperAdminStore from '@/lib/useSuperAdminStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled', 'expired', 'paused'];
const PLAN_OPTIONS = ['starter', 'pro', 'enterprise'];

export default function SuperAdminOrgContextPanel() {
    const { selectedOrgId, selectedOrgName, clearSelectedOrg } = useSuperAdminStore();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({});

    const fetchSummary = async () => {
        if (!selectedOrgId) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/superadmin/orgs/${selectedOrgId}/subscription`);
            setSummary(data);
            setForm({
                plan_id: data.subscription?.plan_id || 'starter',
                status: data.subscription?.status || 'active',
                licensed_seats: data.licensed_seats ?? 10,
                subscription_required: data.subscription_required !== false,
                current_period_end: data.subscription?.current_period_end
                    ? format(parseISO(data.subscription.current_period_end), "yyyy-MM-dd")
                    : '',
                trial_ends_at: data.subscription?.trial_ends_at
                    ? format(parseISO(data.subscription.trial_ends_at), "yyyy-MM-dd")
                    : '',
            });
        } catch (e) {
            console.error(e);
            toast.error('Failed to load organization subscription');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [selectedOrgId]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                licensed_seats: parseInt(form.licensed_seats, 10),
                current_period_end: form.current_period_end
                    ? new Date(`${form.current_period_end}T23:59:59`).toISOString()
                    : undefined,
                trial_ends_at: form.trial_ends_at
                    ? new Date(`${form.trial_ends_at}T23:59:59`).toISOString()
                    : null,
            };
            const { data } = await api.put(`/superadmin/orgs/${selectedOrgId}/subscription`, payload);
            setSummary(data);
            toast.success('Subscription updated');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (!selectedOrgId) return null;

    return (
        <div className="border-b bg-amber-50/80 dark:bg-amber-950/30 px-6 py-4">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-700" />
                    <div>
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                            Viewing organization
                        </p>
                        <h3 className="font-semibold text-lg">{selectedOrgName || summary?.org_name || selectedOrgId}</h3>
                    </div>
                    {summary?.access && (
                        <Badge variant={summary.access.valid ? 'default' : 'destructive'} className="ml-2">
                            {summary.access.valid ? 'Access OK' : summary.access.reason || 'Blocked'}
                        </Badge>
                    )}
                    {summary?.subscription_required === false && (
                        <Badge variant="secondary">Subscription exempt</Badge>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={clearSelectedOrg} title="Clear selection">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading subscription…</p>
            ) : summary ? (
                <div className="grid lg:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Usage</CardTitle>
                            <CardDescription>Billable seats (active employees)</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Seats used:</span> <strong>{summary.seats_used}</strong> / {summary.licensed_seats}</p>
                            <p><span className="text-muted-foreground">Plan:</span> {summary.subscription?.plan_id || '—'}</p>
                            <p><span className="text-muted-foreground">Status:</span> {summary.subscription?.status || '—'}</p>
                            {summary.subscription?.current_period_end && (
                                <p><span className="text-muted-foreground">Renews / ends:</span>{' '}
                                    {format(parseISO(summary.subscription.current_period_end), 'MMM d, yyyy')}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Manage subscription</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSave} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Subscription required</Label>
                                    <Switch
                                        checked={form.subscription_required}
                                        onCheckedChange={(v) => setForm((f) => ({ ...f, subscription_required: v }))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Plan</Label>
                                        <Select value={form.plan_id} onValueChange={(v) => setForm((f) => ({ ...f, plan_id: v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {PLAN_OPTIONS.map((p) => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Status</Label>
                                        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map((s) => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Licensed seats</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={form.licensed_seats}
                                        onChange={(e) => setForm((f) => ({ ...f, licensed_seats: e.target.value }))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Period end</Label>
                                        <Input
                                            type="date"
                                            value={form.current_period_end}
                                            onChange={(e) => setForm((f) => ({ ...f, current_period_end: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Trial ends</Label>
                                        <Input
                                            type="date"
                                            value={form.trial_ends_at}
                                            onChange={(e) => setForm((f) => ({ ...f, trial_ends_at: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <Button type="submit" size="sm" disabled={saving}>
                                    {saving ? 'Saving…' : 'Save subscription'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </div>
    );
}
