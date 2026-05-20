import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertTriangle, Ticket, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const status = searchParams.get('status');
  const amount = searchParams.get('amount');
  const itemName = searchParams.get('item_name');
  const itemType = searchParams.get('item_type');
  const itemId = searchParams.get('item_id');
  const userId = searchParams.get('user_id');
  const customerEmail = searchParams.get('customer_email') || '';
  const customerName = searchParams.get('customer_name') || '';
  const quantity = searchParams.get('quantity');
  const attendeeNamesRaw = searchParams.get('attendee_names');
  const orderId = searchParams.get('order_id') || searchParams.get('wp_order_id');
  const isSuccess = status === 'success';

  useEffect(() => {
    if (!isSuccess) {
      setIsVerifying(false);
      return;
    }

    let cancelled = false;
    const minDelay = new Promise((r) => setTimeout(r, 1500));

    const callVerify = async () => {
      let attendeeNames: string[] = [];
      if (attendeeNamesRaw) {
        try {
          const parsed = JSON.parse(attendeeNamesRaw);
          if (Array.isArray(parsed)) attendeeNames = parsed;
        } catch { /* ignore */ }
      }
      const amountCents = amount ? Math.round(Number(amount) * 100) : 0;
      return supabase.functions.invoke('verify-swish-payment', {
        body: {
          item_type: itemType,
          item_id: itemId || undefined,
          user_id: userId,
          customer_email: customerEmail,
          customer_name: customerName,
          amount_cents: amountCents,
          quantity: quantity ? Number(quantity) : 1,
          wp_order_id: orderId || undefined,
          attendee_names: attendeeNames,
        },
      });
    };

    const register = async () => {
      // If we don't have what we need, just show success (WP-side may have handled it).
      if (!itemType || !userId) {
        await minDelay;
        if (!cancelled) setIsVerifying(false);
        return;
      }
      try {
        // First attempt — wait for it (no premature success).
        let { error } = await callVerify();
        // Retry once on failure (transient network / cold start).
        if (error) {
          console.warn('verify-swish-payment first attempt failed, retrying in 1s:', error);
          await new Promise((r) => setTimeout(r, 1000));
          const retry = await callVerify();
          error = retry.error;
        }

        if (error) {
          console.error('verify-swish-payment failed after retry:', error);
          if (!cancelled) setVerifyError(error.message || 'Verification failed');
        }
      } catch (e) {
        console.error('verify-swish-payment exception:', e);
        if (!cancelled) setVerifyError(e instanceof Error ? e.message : 'Verification failed');
      } finally {
        await minDelay;
        if (!cancelled) setIsVerifying(false);
      }
    };

    register();

    return () => {
      cancelled = true;
    };
  }, [isSuccess, itemType, itemId, userId, customerEmail, customerName, amount, quantity, attendeeNamesRaw, orderId]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'hsl(40 30% 14%)' }}
    >
      {isSuccess && isVerifying ? (
        <div className="text-center space-y-6 animate-fade-in">
          <Loader2
            className="h-16 w-16 mx-auto animate-spin"
            style={{ color: '#00B9ED' }}
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white">
              Verifierar din betalning...
            </h1>
            <p className="text-white/70">Vänta ett ögonblick</p>
          </div>
        </div>
      ) : isSuccess && !verifyError ? (
        <Card className="max-w-md w-full shadow-2xl animate-fade-in">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center animate-scale-in">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" strokeWidth={2.5} />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Betalning genomförd! 🎉
              </h1>
              <p className="text-muted-foreground">
                Tack för ditt köp! Din bekräftelse har skickats till din e-post.
              </p>
            </div>

            {(amount || itemName) && (
              <div className="space-y-3">
                {amount && (
                  <div className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-primary-foreground font-semibold shadow-md">
                    SEK {amount}
                  </div>
                )}
                {itemName && (
                  <p className="text-lg font-semibold text-foreground">
                    {itemName}
                  </p>
                )}
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <Button
                onClick={() => navigate('/biljetter')}
                className="w-full gap-2"
                size="lg"
              >
                <Ticket className="h-4 w-4" />
                Visa mina biljetter
              </Button>
              <Button
                onClick={() => navigate('/event')}
                variant="outline"
                className="w-full gap-2"
                size="lg"
              >
                <Calendar className="h-4 w-4" />
                Gå till evenemang
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Dina biljetter finns under Mina Biljetter i menyn
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-md w-full shadow-2xl animate-fade-in">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center animate-scale-in">
              <div className="rounded-full bg-amber-100 p-4">
                <AlertTriangle className="h-14 w-14 text-amber-500" strokeWidth={2.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                {verifyError ? 'Kunde inte registrera biljetten' : 'Något gick fel'}
              </h1>
              <p className="text-muted-foreground">
                Om du betalat men inte fått bekräftelse, kontakta oss på{' '}
                <a
                  href="mailto:info@dancevida.se"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  info@dancevida.se
                </a>
              </p>
              {verifyError && (
                <p className="text-xs text-muted-foreground mt-2">{verifyError}</p>
              )}
            </div>
            <Button
              onClick={() => navigate('/event')}
              className="w-full"
              size="lg"
            >
              Gå tillbaka
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Confirmation;
