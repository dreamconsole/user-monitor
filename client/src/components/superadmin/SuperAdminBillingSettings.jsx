import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const DEFAULT = {
    bank_account_name: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    upi_id: '',
    qr_image_url: '',
    support_email: '',
    staff_notification_email: '',
    price_per_seat_monthly: 200,
    currency: 'INR',
    manual_review_message:
        'Our staff will verify your payment manually. Activation usually takes 6–8 hours after you submit your transaction ID.',
};

export default function SuperAdminBillingSettings() {
    const [form, setForm] = useState(DEFAULT);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/superadmin/settings').then(({ data }) => {
            const raw = data?.billing_manual_payment?.value;
            if (raw && typeof raw === 'object') {
                setForm({ ...DEFAULT, ...raw });
            } else if (typeof raw === 'string') {
                try {
                    setForm({ ...DEFAULT, ...JSON.parse(raw) });
                } catch {
                    /* keep defaults */
                }
            }
        }).catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await api.put('/superadmin/settings', {
                settings: [{ key: 'billing_manual_payment', value: form }],
            });
            toast.success('Billing settings saved');
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual payment (bank / UPI)</CardTitle>
                <CardDescription>Shown on org admin Billing page. Configure bank, QR URL, and staff email for payment notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Price per seat / month</Label>
                        <Input type="number" value={form.price_per_seat_monthly} onChange={(e) => set('price_per_seat_monthly', Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} />
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Account holder name</Label>
                        <Input value={form.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Bank name</Label>
                        <Input value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Account number</Label>
                        <Input value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>IFSC</Label>
                        <Input value={form.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>UPI ID</Label>
                        <Input value={form.upi_id} onChange={(e) => set('upi_id', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>QR image URL</Label>
                        <Input placeholder="https://... or /uploads/qr.png" value={form.qr_image_url} onChange={(e) => set('qr_image_url', e.target.value)} />
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Support email</Label>
                        <Input type="email" value={form.support_email} onChange={(e) => set('support_email', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Staff notification email (payment alerts)</Label>
                        <Input type="email" value={form.staff_notification_email} onChange={(e) => set('staff_notification_email', e.target.value)} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Message on payment page</Label>
                    <Textarea rows={3} value={form.manual_review_message} onChange={(e) => set('manual_review_message', e.target.value)} />
                </div>
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save billing settings'}</Button>
            </CardContent>
        </Card>
    );
}
