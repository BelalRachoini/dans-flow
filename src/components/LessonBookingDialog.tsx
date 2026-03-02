import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguageStore } from "@/store/languageStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { Loader2, Calendar, Clock, MapPin, Ticket, CreditCard } from "lucide-react";
import { SwishIcon } from "./icons/SwishIcon";
import { SwishPaymentStatus } from "./SwishPaymentStatus";

interface LessonBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: {
    id: string;
    title: string | null;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
    course_id: string;
  } | null;
}

type PaymentMethod = 'card' | 'swish';

export const LessonBookingDialog = ({ open, onOpenChange, lesson }: LessonBookingDialogProps) => {
  const { language, t } = useLanguageStore();
  const [availableTickets, setAvailableTickets] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingTickets, setCheckingTickets] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [swishPaymentId, setSwishPaymentId] = useState<string | null>(null);
  const [swishToken, setSwishToken] = useState<string>('');

  const getDateLocale = () => {
    switch (language) {
      case 'sv': return sv;
      case 'es': return es;
      default: return enUS;
    }
  };

  useEffect(() => {
    if (open && lesson) {
      fetchAvailableTickets();
      setPaymentMethod('card');
      setSwishPaymentId(null);
    }
  }, [open, lesson]);

  const fetchAvailableTickets = async () => {
    setCheckingTickets(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tickets } = await supabase
        .from("tickets")
        .select("total_tickets, tickets_used, expires_at")
        .eq("member_id", user.id)
        .eq("status", "valid")
        .gt("expires_at", new Date().toISOString());
      if (tickets) {
        const available = tickets.reduce((sum, ticket) => sum + (ticket.total_tickets - ticket.tickets_used), 0);
        setAvailableTickets(available);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setCheckingTickets(false);
    }
  };

  const handleUseExistingTicket = async () => {
    if (!lesson) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t.auth.loginRequired); return; }
      const { error } = await supabase
        .from("lesson_bookings")
        .insert({ member_id: user.id, lesson_id: lesson.id, ticket_type: 'existing', checkins_allowed: 1, status: 'valid' })
        .select().single();
      if (error) throw error;
      toast.success(t.lessonBooking.bookingSuccess);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating booking:", error);
      toast.error(error.message || t.lessonBooking.bookingError);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyDropIn = async (ticketType: 'single' | 'couple' | 'trio') => {
    if (!lesson) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t.auth.loginRequired); return; }

      const priceMap = { single: 150, couple: 250, trio: 350 };
      const amountSek = priceMap[ticketType];

      if (paymentMethod === 'swish') {
        const { data, error } = await supabase.functions.invoke("create-swish-payment", {
          body: {
            payment_type: 'lesson',
            amount_sek: amountSek,
            metadata: {
              lesson_id: lesson.id,
              ticket_type: ticketType,
              message: `Drop-in ${lesson.title || 'lektion'}`.substring(0, 50),
            },
          },
        });
        if (error) throw error;
        setSwishPaymentId(data.paymentRequestId);
        setSwishToken(data.paymentRequestToken || '');
      } else {
        const { data, error } = await supabase.functions.invoke("create-lesson-payment", {
          body: { lesson_id: lesson.id, ticket_type: ticketType },
        });
        if (error) throw error;
        if (data?.url) window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error("Error creating payment:", error);
      toast.error(error.message || t.lessonBooking.paymentError);
    } finally {
      setLoading(false);
    }
  };

  if (!lesson) return null;

  const lessonDate = new Date(lesson.starts_at);
  const lessonEndTime = lesson.ends_at ? new Date(lesson.ends_at) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.lessonBooking.title}</DialogTitle>
            <DialogDescription>{t.lessonBooking.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lesson Details */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
              <h3 className="font-semibold">{lesson.title || t.lessonBooking.lessonDetails}</h3>
              <div className="flex items-start gap-2 text-sm">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>{format(lessonDate, "PPP", { locale: getDateLocale() })}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>{format(lessonDate, "HH:mm")}{lessonEndTime && ` - ${format(lessonEndTime, "HH:mm")}`}</span>
              </div>
              {lesson.venue && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /><span>{lesson.venue}</span>
                </div>
              )}
            </div>

            {/* Available Tickets */}
            {checkingTickets ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {availableTickets > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{t.lessonBooking.availableTickets}</span></div>
                    <span className="font-semibold">{availableTickets}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {availableTickets > 0 && (
                    <Button onClick={handleUseExistingTicket} disabled={loading} className="w-full" variant="default">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.lessonBooking.useTicket}
                    </Button>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {availableTickets > 0 ? t.lessonBooking.or : t.lessonBooking.buyDropIn}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Betalmetod</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={paymentMethod === 'card' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card')} className="gap-2" type="button" size="sm">
                        <CreditCard className="h-4 w-4" /> Kort
                      </Button>
                      <Button variant="outline" onClick={() => setPaymentMethod('swish')} className="gap-2" style={paymentMethod === 'swish' ? { backgroundColor: '#f97316', color: 'white', borderColor: '#f97316' } : {}} type="button" size="sm">
                        <SwishIcon className="h-4 w-4" /> Swish
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={() => handleBuyDropIn('single')} disabled={loading} variant="outline" className="h-auto py-3">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs text-center">{t.lessonBooking.single}<br />150 kr</span>}
                    </Button>
                    <Button onClick={() => handleBuyDropIn('couple')} disabled={loading} variant="outline" className="h-auto py-3">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs text-center">{t.lessonBooking.couple}<br />250 kr</span>}
                    </Button>
                    <Button onClick={() => handleBuyDropIn('trio')} disabled={loading} variant="outline" className="h-auto py-3">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs text-center">{t.lessonBooking.trio}<br />350 kr</span>}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {swishPaymentId && (
        <SwishPaymentStatus
          open={!!swishPaymentId}
          onOpenChange={(open) => { if (!open) setSwishPaymentId(null); }}
          paymentRequestId={swishPaymentId}
          paymentRequestToken={swishToken}
          onSuccess={() => { toast.success('Betalning klar!'); onOpenChange(false); setSwishPaymentId(null); }}
        />
      )}
    </>
  );
};
