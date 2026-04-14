import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Smartphone, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentMethodStepProps {
  itemName: string;
  itemType: 'event' | 'course' | 'ticket';
  amount: number;
  quantity: number;
  onSelectStripe: () => void;
  onBack: () => void;
  processing: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  event: 'Event',
  course: 'Kurs',
  ticket: 'Biljett',
};

export function PaymentMethodStep({
  itemName,
  itemType,
  amount,
  quantity,
  onSelectStripe,
  onBack,
  processing,
}: PaymentMethodStepProps) {
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCustomerEmail(session.user.email || '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single();
        setCustomerName(profile?.full_name || '');
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setLoadingUser(false);
    };
    fetchUser();
  }, []);

  const handleSwish = () => {
    const params = new URLSearchParams({
      item_name: itemName,
      item_type: itemType,
      amount: String(amount),
      quantity: String(quantity),
      customer_email: customerEmail,
      customer_name: customerName,
      return_url: 'https://cms.dancevida.se/confirmation',
    });
    window.location.href = `https://dancevida.se/swish-checkout/?${params.toString()}`;
  };

  const canSwish = customerEmail.trim().length > 0 && customerName.trim().length > 0;

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Order Summary */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{itemName}</p>
              <Badge variant="secondary" className="mt-1">{TYPE_LABELS[itemType]}</Badge>
            </div>
            {quantity > 1 && (
              <span className="text-sm text-muted-foreground">x{quantity}</span>
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-medium">Totalt</span>
            <span className="text-xl font-bold">{amount} SEK</span>
          </div>
        </CardContent>
      </Card>

      {/* Guest email/name fields */}
      {!isLoggedIn && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="guest-name">Namn</Label>
            <Input
              id="guest-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ditt namn"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="guest-email">E-post</Label>
            <Input
              id="guest-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="din@email.se"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Payment Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onSelectStripe}
          disabled={processing}
          className="w-full gap-2"
          size="lg"
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Betala med kort
        </Button>

        <Button
          onClick={handleSwish}
          disabled={processing || !canSwish}
          className="w-full gap-2 bg-[#00B9ED] hover:bg-[#00a5d4] text-white"
          size="lg"
          variant="secondary"
        >
          <Smartphone className="h-4 w-4" />
          Betala med Swish
        </Button>
      </div>

      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <ArrowLeft className="h-3 w-3" />
        Tillbaka
      </button>
    </div>
  );
}
