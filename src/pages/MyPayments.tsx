import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PaymentRow {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  description: string;
}

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

      const { data: stripe } = await supabase
        .from('payments')
        .select('id, amount_cents, currency, status, created_at, description')
        .eq('member_id', userId)
        .order('created_at', { ascending: false });

      const results: PaymentRow[] = (stripe || []).map((p) => ({
        id: p.id,
        amount_cents: p.amount_cents,
        currency: p.currency,
        status: p.status,
        created_at: p.created_at,
        description: p.description || 'Kortbetalning',
      }));

      setPayments(results);
      setLoading(false);
    };

    fetchPayments();
  }, [userId]);

  const handleDownloadReceipt = async (payment: PaymentRow) => {
    setDownloadingId(payment.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt', {
        body: { payment_id: payment.id, payment_source: 'stripe' },
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kvitto-${payment.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Receipt download error:', err);
      toast({
        title: t.myPayments.downloadError,
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const isPaid = (status: string) => {
    const s = status.toLowerCase();
    return s === 'paid' || s === 'succeeded' || s === 'complete';
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
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
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="shrink-0 rounded-full bg-muted p-2">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{payment.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.created_at), 'yyyy-MM-dd HH:mm')}
                      {' · Kort'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="font-semibold">{(payment.amount_cents / 100).toFixed(0)} {payment.currency}</p>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPayments;
