import { useState, useEffect } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, CreditCard, Mail, Clock, AlertTriangle } from 'lucide-react';
import SubscriptionDaysChart from '@/components/billing/SubscriptionDaysChart';

export default function Payment() {
    const { user, refreshUser } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [data, setData] = useState(null);
    const [transactionId, setTransactionId] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const { data: res } = await api.get('/org/payment');
            setData(res);
        } catch (e) {
            toast.error('Failed to load payment details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSubmit = async () => {
        if (!transactionId.trim()) {
            toast.error('Please enter your transaction ID');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/org/payment/submit', {
                transaction_id: transactionId.trim(),
                amount: data?.amount_due,
            });
            toast.success('Submitted for verification (6–8 hours)');
            setTransactionId('');
            await load();
            await refreshUser();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleNotify = async () => {
        if (!transactionId.trim()) {
            toast.error('Enter transaction ID before sending notification');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/org/payment/notify', { transaction_id: transactionId.trim() });
            toast.success('Email sent to our team. Verification in 6–8 hours.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Could not send email');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    const cfg = data?.billing_config || {};
    const sub = data?.subscription;
    const locked = sub?.billing?.billing_locked || user?.billing?.billing_locked;
    const daysLeft = sub?.billing?.days_remaining ?? 0;
    const periodDays = sub?.billing?.period_total_days ?? 30;

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-4 pb-16">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Subscription &amp; payment</h1>
                <p className="text-muted-foreground mt-1">
                    {locked
                        ? 'Your subscription has ended. Complete payment to restore access for your organization.'
                        : 'Renew or extend your plan using bank transfer or UPI.'}
                </p>
            </div>

            {locked && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-destructive">Subscription ended</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Only organization admins can sign in. Other users cannot access the dashboard until payment is verified.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
                <Card className="md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Period status</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center pb-4">
                        <SubscriptionDaysChart
                            daysRemaining={daysLeft}
                            periodTotalDays={periodDays}
                            label={locked ? 'days (expired)' : 'days left'}
                        />
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Amount due</CardTitle>
                        <CardDescription>
                            {sub?.licensed_seats} seats × {cfg.currency || 'INR'} {cfg.price_per_seat_monthly}/seat/month
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {cfg.currency === 'INR' ? '₹' : ''}{data?.amount_due?.toLocaleString() ?? '—'}
                        </p>
                        {data?.pending_request && (
                            <Badge className="mt-3" variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending review: {data.pending_request.transaction_id}
                            </Badge>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Building2 className="w-5 h-5" />
                            Bank transfer
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {cfg.bank_account_name && <p><span className="text-muted-foreground">Account name:</span> {cfg.bank_account_name}</p>}
                        {cfg.bank_name && <p><span className="text-muted-foreground">Bank:</span> {cfg.bank_name}</p>}
                        {cfg.bank_account_number && <p><span className="text-muted-foreground">Account no:</span> <span className="font-mono">{cfg.bank_account_number}</span></p>}
                        {cfg.bank_ifsc && <p><span className="text-muted-foreground">IFSC:</span> <span className="font-mono">{cfg.bank_ifsc}</span></p>}
                        {cfg.upi_id && <p><span className="text-muted-foreground">UPI ID:</span> <span className="font-mono">{cfg.upi_id}</span></p>}
                        {!cfg.bank_account_number && !cfg.upi_id && (
                            <p className="text-muted-foreground">Bank details not configured. Contact support.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="w-5 h-5" />
                            UPI / QR
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-3">
                        {cfg.qr_image_url ? (
                            <img
                                src={cfg.qr_image_url}
                                alt="Payment QR"
                                className="w-48 h-48 object-contain border rounded-lg bg-white"
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground text-center">QR image not uploaded yet.</p>
                        )}
                        {cfg.upi_id && <p className="font-mono text-sm">{cfg.upi_id}</p>}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Submit payment proof</CardTitle>
                    <CardDescription>
                        {cfg.manual_review_message ||
                            'Our staff will verify your payment manually. Activation usually takes 6–8 hours.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="txid">Transaction ID / UTR / Reference number</Label>
                        <Input
                            id="txid"
                            placeholder="e.g. 123456789012"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button onClick={handleSubmit} disabled={submitting}>
                            Submit for verification
                        </Button>
                        <Button variant="outline" onClick={handleNotify} disabled={submitting}>
                            <Mail className="w-4 h-4 mr-2" />
                            Send email to staff
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
