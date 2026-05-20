import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, CreditCard, Smartphone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PaymentRow {
  id: string;
  source: 'stripe' | 'swish';
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  description: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const MyPayments = () => {
  const { userId } = useAuthStore();
  const { t } = useLanguageStore();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchPayments = async () => {
      setLoading(true);

      const [stripeRes, swishRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount_cents, currency, status, created_at, description')
          .eq('member_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('swish_payments')
          .select('id, amount_cents, currency, status, created_at, payment_type, metadata')
          .eq('member_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      const stripeRows: PaymentRow[] = (stripeRes.data || []).map((p) => ({
        id: p.id,
        source: 'stripe',
        amount_cents: p.amount_cents,
        currency: p.currency,
        status: p.status,
        created_at: p.created_at,
        description: p.description || 'Kortbetalning',
      }));

      const swishRows: PaymentRow[] = (swishRes.data || []).map((p) => {
        const meta = (p.metadata as any) || {};
        const desc =
          meta.description ||
          meta.event_title ||
          meta.course_title ||
          (p.payment_type === 'event'
            ? 'Eventbiljett'
            : p.payment_type === 'tickets'
            ? 'Klippkort'
            : 'Swish-betalning');
        return {
          id: p.id,
          source: 'swish',
          amount_cents: p.amount_cents,
          currency: p.currency,
          status: p.status,
          created_at: p.created_at,
          description: desc,
        };
      });

      const merged = [...stripeRows, ...swishRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPayments(merged);
      setLoading(false);
    };

    fetchPayments();
  }, [userId]);

  const handleDownloadReceipt = async (payment: PaymentRow) => {
    setDownloadingId(payment.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_id: payment.id, payment_source: payment.source }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kvitto-${payment.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('Receipt download error:', err);
      toast({
        title: t.myPayments.downloadError,
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const isPaid = (status: string) => {
    const s = (status || '').toLowerCase();
    return s === 'paid' || s === 'succeeded' || s === 'complete';
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (isPaid(s)) return <Badge className="bg-primary text-primary-foreground">{t.myPayments.statusPaid}</Badge>;
    if (s === 'created' || s === 'pending') return <Badge variant="secondary">{t.myPayments.statusPending}</Badge>;
    return <Badge variant="destructive">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{t.myPayments.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.myPayments.subtitle}</p>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.myPayments.noPayments}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const Icon = payment.source === 'swish' ? Smartphone : CreditCard;
            const methodLabel = payment.source === 'swish' ? 'Swish' : 'Kort';
            return (
              <Card key={`${payment.source}-${payment.id}`}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0 rounded-full bg-muted p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{payment.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), 'yyyy-MM-dd HH:mm')}
                        {' · '}
                        {methodLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="font-semibold">
                        {(payment.amount_cents / 100).toFixed(0)} {payment.currency}
                      </p>
                      {getStatusBadge(payment.status)}
                    </div>
                    {isPaid(payment.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReceipt(payment)}
                        disabled={downloadingId === payment.id}
                      >
                        {downloadingId === payment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline ml-1">{t.myPayments.downloadReceipt}</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyPayments;
