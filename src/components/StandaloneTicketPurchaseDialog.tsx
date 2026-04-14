import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/languageStore';
import { PaymentMethodStep } from './PaymentMethodStep';

interface StandaloneTicketPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'select' | 'payment';

interface SelectedPkg {
  count: number;
  price: number;
}

export function StandaloneTicketPurchaseDialog({ open, onOpenChange }: StandaloneTicketPurchaseDialogProps) {
  const { t } = useLanguageStore();
  const [purchasing, setPurchasing] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [selectedPkg, setSelectedPkg] = useState<SelectedPkg | null>(null);

  const ticketPackages = [
    { count: 1, price: 150, savings: 0, pricePerTicket: 150 },
    { count: 2, price: 250, savings: 50, pricePerTicket: 125 },
    { count: 3, price: 350, savings: 100, pricePerTicket: 117 },
  ];

  const handleStripePayment = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t.auth.loginRequired); onOpenChange(false); return; }

      const { data, error } = await supabase.functions.invoke('create-standalone-ticket-payment', {
        body: { ticketCount: selectedPkg.count },
      });
      if (error) throw error;
      if (data?.url) { window.open(data.url, '_blank'); onOpenChange(false); }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(t.lessonBooking.paymentError);
    } finally {
      setPurchasing(false);
    }
  };

  const handleSelectPackage = (pkg: { count: number; price: number }) => {
    setSelectedPkg(pkg);
    setStep('payment');
  };

  // Reset step when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) { setStep('select'); setSelectedPkg(null); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Ticket className="h-6 w-6" />
            Köp Klippkort
          </DialogTitle>
          <DialogDescription>
            Köp klippkort som kan användas för alla lektioner. Klippkorten är giltiga i 3 månader.
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <>
            <div className="grid gap-4 py-4">
              {ticketPackages.map((pkg) => (
                <div key={pkg.count} className="relative rounded-lg border-2 p-6 hover:border-primary transition-colors">
                  {pkg.savings > 0 && (
                    <Badge className="absolute -top-3 -right-3 bg-primary text-primary-foreground">
                      Spara {pkg.savings}kr
                    </Badge>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{pkg.count} Klipp</h3>
                      <p className="text-sm text-muted-foreground">{pkg.pricePerTicket}kr per klipp</p>
                      {pkg.savings > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                            <span>Ordinarie: {pkg.count * 150}kr</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <Check className="h-4 w-4" />
                            <span>Spara {pkg.savings}kr ({Math.round((pkg.savings / (pkg.count * 150)) * 100)}%)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold mb-2">{pkg.price}kr</div>
                      <Button
                        onClick={() => handleSelectPackage(pkg)}
                        variant={pkg.count === 2 ? "default" : "outline"}
                      >
                        Köp nu
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ Giltigt i 3 månader</p>
              <p>✓ Kan användas för alla lektioner</p>
              <p>✓ Flexibelt - använd när det passar dig</p>
            </div>
          </>
        ) : selectedPkg && (
          <PaymentMethodStep
            itemName={`${selectedPkg.count} Klipp`}
            itemType="ticket"
            amount={selectedPkg.price}
            quantity={selectedPkg.count}
            onSelectStripe={handleStripePayment}
            onBack={() => setStep('select')}
            processing={purchasing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
