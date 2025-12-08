import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Ticket, Users, User, Check } from 'lucide-react';
import { useLanguageStore } from '@/store/languageStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  price_cents: number;
  couple_price_cents: number | null;
  trio_price_cents: number | null;
  currency: string;
  capacity: number;
  sold_count: number;
}

interface EventTicketPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
}

type TicketOption = 1 | 2 | 3;

export function EventTicketPurchaseDialog({
  open,
  onOpenChange,
  event,
}: EventTicketPurchaseDialogProps) {
  const { t, language } = useLanguageStore();
  const [selectedOption, setSelectedOption] = useState<TicketOption>(1);
  const [attendeeNames, setAttendeeNames] = useState<string[]>(['', '', '']);
  const [processing, setProcessing] = useState(false);
  const [buyerName, setBuyerName] = useState<string>('');

  const availableSpots = event.capacity - event.sold_count;

  // Fetch buyer's name when dialog opens
  useEffect(() => {
    if (open) {
      const fetchBuyerName = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', session.user.id)
            .single();
          
          if (profile?.full_name) {
            setBuyerName(profile.full_name);
          }
        }
      };
      fetchBuyerName();
      // Reset state when dialog opens
      setSelectedOption(1);
      setAttendeeNames(['', '', '']);
    }
  }, [open]);

  // Calculate prices
  const singlePrice = event.price_cents / 100;
  const couplePrice = event.couple_price_cents 
    ? event.couple_price_cents / 100 
    : singlePrice * 2;
  const trioPrice = event.trio_price_cents 
    ? event.trio_price_cents / 100 
    : singlePrice * 3;

  // Calculate savings
  const coupleSavings = (singlePrice * 2) - couplePrice;
  const trioSavings = (singlePrice * 3) - trioPrice;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: event.currency || 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleOptionSelect = (option: TicketOption) => {
    setSelectedOption(option);
  };

  const handleAttendeeNameChange = (index: number, value: string) => {
    const newNames = [...attendeeNames];
    newNames[index] = value;
    setAttendeeNames(newNames);
  };

  const isFormValid = () => {
    if (selectedOption === 1) return true;
    // For 2+ tickets, only additional attendee names (Person 2, 3) must be filled
    // Person 1 (buyer) is auto-filled
    return attendeeNames.slice(0, selectedOption - 1).every(name => name.trim().length > 0);
  };

  const canSelectOption = (option: TicketOption) => {
    return availableSpots >= option;
  };

  const handlePurchase = async () => {
    if (!isFormValid()) {
      toast.error(t.eventTickets?.fillAllNames || 'Please fill in all attendee names');
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error(t.auth.loginRequired);
        return;
      }

      // Build attendee names: buyer first, then additional attendees
      const namesToSend = selectedOption > 1 
        ? [buyerName, ...attendeeNames.slice(0, selectedOption - 1).map(n => n.trim())]
        : [buyerName];

      const { data, error } = await supabase.functions.invoke('create-event-payment', {
        body: { 
          event_id: event.id,
          ticket_count: selectedOption,
          attendee_names: namesToSend,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.message || t.common.error);
    } finally {
      setProcessing(false);
    }
  };

  const ticketOptions = [
    {
      count: 1 as TicketOption,
      label: t.eventTickets?.singleTicket || '1 Ticket',
      price: singlePrice,
      savings: 0,
      icon: User,
    },
    {
      count: 2 as TicketOption,
      label: t.eventTickets?.coupleTickets || '2 Tickets (Couple)',
      price: couplePrice,
      savings: coupleSavings,
      icon: Users,
    },
    {
      count: 3 as TicketOption,
      label: t.eventTickets?.trioTickets || '3 Tickets',
      price: trioPrice,
      savings: trioSavings,
      icon: Users,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            {t.eventTickets?.buyTickets || 'Buy Tickets'}
          </DialogTitle>
          <DialogDescription>
            {event.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ticket Options */}
          <div className="space-y-3">
            {ticketOptions.map((option) => {
              const isSelected = selectedOption === option.count;
              const isDisabled = !canSelectOption(option.count);
              const Icon = option.icon;

              return (
                <Card
                  key={option.count}
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : isDisabled 
                        ? 'opacity-50 cursor-not-allowed border-muted' 
                        : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => !isDisabled && handleOptionSelect(option.count)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{option.label}</p>
                        {option.savings > 0 && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {t.eventTickets?.save || 'Save'} {formatPrice(option.savings)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatPrice(option.price)}</p>
                      {isDisabled && (
                        <p className="text-xs text-muted-foreground">
                          {t.eventTickets?.notEnoughSpots || 'Not enough spots'}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Attendee Names (for 2+ tickets) */}
          {selectedOption > 1 && (
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-base font-semibold">
                {t.eventTickets?.attendeeNames || 'Attendee Names'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t.eventTickets?.attendeeNamesDescription || 'Enter the name of each person attending'}
              </p>
              
              {/* Person 1 - Buyer (auto-filled, read-only) */}
              <div>
                <Label className="text-sm">
                  {t.eventTickets?.person || 'Person'} 1
                </Label>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-muted rounded-md">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{buyerName || '...'}</span>
                </div>
              </div>

              {/* Additional attendees (Person 2, 3) */}
              {Array.from({ length: selectedOption - 1 }).map((_, index) => (
                <div key={index}>
                  <Label htmlFor={`attendee-${index}`} className="text-sm">
                    {t.eventTickets?.person || 'Person'} {index + 2}
                  </Label>
                  <Input
                    id={`attendee-${index}`}
                    value={attendeeNames[index]}
                    onChange={(e) => handleAttendeeNameChange(index, e.target.value)}
                    placeholder={`${t.eventTickets?.enterName || 'Enter name'}...`}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Purchase Button */}
          <Button
            onClick={handlePurchase}
            disabled={processing || !isFormValid()}
            className="w-full"
            size="lg"
          >
            {processing 
              ? (t.common.loading || 'Processing...') 
              : `${t.eventTickets?.buyNow || 'Buy Now'} - ${formatPrice(
                  selectedOption === 1 ? singlePrice :
                  selectedOption === 2 ? couplePrice : trioPrice
                )}`
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}