import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import {
  Ticket as TicketIcon,
  CalendarDays,
  GraduationCap,
  User,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export type PaymentForDetail = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountSEK: number;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  method?: string;
  stripePaymentIntentId?: string;
};

type ResolvedTicket = {
  id: string;
  total_tickets: number;
  tickets_used: number;
  status: string;
  expires_at: string | null;
  source_course_id: string | null;
  course_id: string | null;
  order_id: string | null;
  purchased_at: string;
  course_title?: string | null;
};
type ResolvedEventBooking = {
  id: string;
  ticket_count: number;
  status: string;
  checkins_used: number;
  checkins_allowed: number;
  payment_reference: string | null;
  created_at: string;
  event_id: string;
  event_title?: string | null;
  event_start_at?: string | null;
};
type ResolvedLessonBooking = {
  id: string;
  status: string;
  checkins_used: number;
  checkins_allowed: number;
  created_at: string;
  lesson_id: string;
  lesson_title?: string | null;
  starts_at?: string | null;
};

interface Props {
  payment: PaymentForDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIME_WINDOW_MS = 30 * 60 * 1000; // 30 minutes around payment

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtDateOnly(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function PaymentDetailDialog({ payment, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<ResolvedTicket[]>([]);
  const [eventBookings, setEventBookings] = useState<ResolvedEventBooking[]>([]);
  const [lessonBookings, setLessonBookings] = useState<ResolvedLessonBooking[]>([]);

  useEffect(() => {
    if (!open || !payment || !payment.userId || payment.userId === 'unknown') {
      setTickets([]); setEventBookings([]); setLessonBookings([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const pTime = new Date(payment.createdAt).getTime();
        const from = new Date(pTime - TIME_WINDOW_MS).toISOString();
        const to = new Date(pTime + TIME_WINDOW_MS).toISOString();
        const ref = payment.stripePaymentIntentId || '';

        // Tickets: match by order_id (exact) OR member_id + time window
        const ticketsQ = supabase
          .from('tickets')
          .select('id,total_tickets,tickets_used,status,expires_at,source_course_id,course_id,order_id,purchased_at')
          .eq('member_id', payment.userId)
          .gte('purchased_at', from)
          .lte('purchased_at', to);

        const eventBookingsQ = supabase
          .from('event_bookings')
          .select('id,ticket_count,status,checkins_used,checkins_allowed,payment_reference,created_at,event_id')
          .eq('member_id', payment.userId)
          .gte('created_at', from)
          .lte('created_at', to);

        const lessonBookingsQ = supabase
          .from('lesson_bookings')
          .select('id,status,checkins_used,checkins_allowed,created_at,lesson_id')
          .eq('member_id', payment.userId)
          .gte('created_at', from)
          .lte('created_at', to);

        const [tRes, eRes, lRes] = await Promise.all([ticketsQ, eventBookingsQ, lessonBookingsQ]);

        // Also query for exact order_id matches outside the window, as a safety net
        let tExact: ResolvedTicket[] = [];
        if (ref) {
          const { data } = await supabase
            .from('tickets')
            .select('id,total_tickets,tickets_used,status,expires_at,source_course_id,course_id,order_id,purchased_at')
            .eq('order_id', ref);
          tExact = (data ?? []) as any;
        }
        let eExact: ResolvedEventBooking[] = [];
        if (ref) {
          const { data } = await supabase
            .from('event_bookings')
            .select('id,ticket_count,status,checkins_used,checkins_allowed,payment_reference,created_at,event_id')
            .eq('payment_reference', ref);
          eExact = (data ?? []) as any;
        }

        const mergeBy = <T extends { id: string }>(a: T[], b: T[]) => {
          const map = new Map<string, T>();
          for (const x of [...a, ...b]) map.set(x.id, x);
          return [...map.values()];
        };

        const tList = mergeBy<ResolvedTicket>((tRes.data ?? []) as any, tExact);
        const eList = mergeBy<ResolvedEventBooking>((eRes.data ?? []) as any, eExact);
        const lList = (lRes.data ?? []) as any as ResolvedLessonBooking[];

        // Enrich titles
        const courseIds = [
          ...new Set(
            tList
              .map(t => t.source_course_id || t.course_id)
              .filter(Boolean) as string[]
          ),
        ];
        if (courseIds.length) {
          const { data: courses } = await supabase
            .from('courses')
            .select('id,title')
            .in('id', courseIds);
          const m = new Map((courses ?? []).map((c: any) => [c.id, c.title]));
          tList.forEach(t => {
            const cid = t.source_course_id || t.course_id;
            t.course_title = cid ? m.get(cid) ?? null : null;
          });
        }
        const eventIds = [...new Set(eList.map(e => e.event_id))];
        if (eventIds.length) {
          const { data: events } = await supabase
            .from('events')
            .select('id,title,start_at')
            .in('id', eventIds);
          const m = new Map((events ?? []).map((e: any) => [e.id, e]));
          eList.forEach(e => {
            const ev: any = m.get(e.event_id);
            e.event_title = ev?.title ?? null;
            e.event_start_at = ev?.start_at ?? null;
          });
        }
        const lessonIds = [...new Set(lList.map(l => l.lesson_id))];
        if (lessonIds.length) {
          const { data: lessons } = await supabase
            .from('course_lessons')
            .select('id,title,starts_at')
            .in('id', lessonIds);
          const m = new Map((lessons ?? []).map((l: any) => [l.id, l]));
          lList.forEach(l => {
            const lesson: any = m.get(l.lesson_id);
            l.lesson_title = lesson?.title ?? null;
            l.starts_at = lesson?.starts_at ?? null;
          });
        }

        if (!cancelled) {
          setTickets(tList);
          setEventBookings(eList);
          setLessonBookings(lList);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, payment]);

  if (!payment) return null;

  const totalLinked = tickets.length + eventBookings.length + lessonBookings.length;
  const orphan = !loading && totalLinked === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Betalningsdetaljer</DialogTitle>
          <DialogDescription>
            {payment.userName} · {payment.amountSEK.toLocaleString('sv-SE')} kr · {fmtDate(payment.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {/* Payment meta */}
        <div className="rounded-md border p-3 text-sm grid grid-cols-2 gap-2">
          <div><span className="text-muted-foreground">Metod: </span><span className="capitalize">{payment.method ?? '-'}</span></div>
          <div><span className="text-muted-foreground">Status: </span>{payment.status}</div>
          <div><span className="text-muted-foreground">Typ: </span>{payment.type}</div>
          <div className="truncate"><span className="text-muted-foreground">Ref: </span><span className="font-mono text-xs">{payment.stripePaymentIntentId || payment.id}</span></div>
          <div className="col-span-2"><span className="text-muted-foreground">Beskrivning: </span>{payment.description}</div>
        </div>

        <Separator />

        {/* What was bought */}
        <div>
          <h3 className="font-semibold mb-2">Vad köptes</h3>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Söker kopplade biljetter och bokningar...
            </div>
          )}

          {!loading && orphan && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Ingen koppling hittades</p>
                <p className="text-muted-foreground mt-1">
                  Det finns ingen biljett, eventbokning eller lektion kopplad till den här betalningen
                  inom ±30 min av tidpunkten. Detta kan vara ett problem som behöver undersökas.
                </p>
              </div>
            </div>
          )}

          {!loading && tickets.length > 0 && (
            <div className="space-y-2 mb-3">
              {tickets.map(t => {
                const isStandalone = !t.source_course_id && !t.course_id;
                const isExpired = t.expires_at ? new Date(t.expires_at).getTime() < Date.now() : false;
                const remaining = t.total_tickets - t.tickets_used;
                return (
                  <div key={t.id} className="rounded-md border p-3 flex gap-3">
                    <TicketIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          Klippkort {t.total_tickets} st
                          {isStandalone ? ' — flexibel (ej kopplad till kurs)' : t.course_title ? ` — ${t.course_title}` : ''}
                        </p>
                        <Badge variant={t.status === 'valid' && !isExpired ? 'default' : 'secondary'}>
                          {isExpired ? 'utgånget' : t.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Använt {t.tickets_used}/{t.total_tickets} · {remaining} kvar
                        {t.expires_at && ` · Utgår ${fmtDateOnly(t.expires_at)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && eventBookings.length > 0 && (
            <div className="space-y-2 mb-3">
              {eventBookings.map(e => (
                <div key={e.id} className="rounded-md border p-3 flex gap-3">
                  <CalendarDays className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">
                        Event: {e.event_title ?? 'Okänt event'} — {e.ticket_count} biljett{e.ticket_count !== 1 ? 'er' : ''}
                      </p>
                      <Badge variant={e.status === 'confirmed' || e.status === 'checked_in' ? 'default' : 'secondary'}>
                        {e.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.event_start_at && `${fmtDate(e.event_start_at)} · `}
                      Incheckad {e.checkins_used}/{e.checkins_allowed}
                    </p>
                    {e.event_id && (
                      <Button
                        variant="link" size="sm" className="px-0 h-auto mt-1"
                        onClick={() => { onOpenChange(false); navigate(`/event/${e.event_id}`); }}
                      >
                        Öppna event <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && lessonBookings.length > 0 && (
            <div className="space-y-2 mb-3">
              {lessonBookings.map(l => (
                <div key={l.id} className="rounded-md border p-3 flex gap-3">
                  <GraduationCap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">
                        Drop-in: {l.lesson_title ?? 'Lektion'}
                      </p>
                      <Badge variant="secondary">{l.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {l.starts_at && `${fmtDate(l.starts_at)} · `}
                      Incheckad {l.checkins_used}/{l.checkins_allowed}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Buyer */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{payment.userName}</p>
              <p className="text-xs text-muted-foreground">{payment.userEmail}</p>
            </div>
          </div>
          {payment.userId && payment.userId !== 'unknown' && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/admin/medlemmar?member=${payment.userId}`);
              }}
            >
              Visa medlem <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
