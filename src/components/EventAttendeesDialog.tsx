import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CheckCircle2, AlertCircle, XCircle, Download, CreditCard, Smartphone, ChevronDown, ChevronRight, TrendingUp, Ticket as TicketIcon, BarChart3, Search, AlertTriangle, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type EventRow = Tables<'events'>;

interface BookingRow extends Tables<'event_bookings'> {
  profiles: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface Props {
  event: EventRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ResolvedRow {
  booking: BookingRow;
  paidCents: number | null;
  method: 'stripe' | 'swish' | null;
  perDateCheckins: Record<string, number>; // event_date_id -> count
}

const fmtKr = (cents: number) =>
  `${(cents / 100).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr`;

const ACTIVE = new Set(['confirmed', 'checked_in']);

export function EventAttendeesDialog({ event, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [checkins, setCheckins] = useState<Tables<'event_checkins'>[]>([]);
  const [dates, setDates] = useState<Tables<'event_dates'>[]>([]);
  const [paymentsByMember, setPaymentsByMember] = useState<Record<string, { cents: number; method: 'stripe' | 'swish' }>>({});
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [unreconciled, setUnreconciled] = useState<any[]>([]);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    ticket_count: 1,
    event_date_id: '' as string,
    payment_reference: '',
    amount_kr: '' as string,
    payment_method: 'swish' as 'swish' | 'stripe' | 'cash' | 'other',
  });

  const refreshAll = async () => {
    if (!event) return;
    const [bkRes, drift] = await Promise.all([
      supabase
        .from('event_bookings')
        .select('*, profiles:member_id(id, full_name, email, phone, avatar_url)')
        .eq('event_id', event.id)
        .order('booked_at', { ascending: false }),
      supabase.rpc('admin_list_unreconciled_swish_for_event', { p_event_id: event.id }),
    ]);
    setBookings((bkRes.data || []) as BookingRow[]);
    setUnreconciled((drift.data as any[]) || []);
  };

  const submitManual = async () => {
    if (!event) return;
    if (!manualForm.name.trim()) {
      toast.error('Ange minst ett namn');
      return;
    }
    setManualSaving(true);
    try {
      const amountCents = manualForm.amount_kr
        ? Math.round(parseFloat(manualForm.amount_kr.replace(',', '.')) * 100)
        : 0;
      const { data, error } = await supabase.rpc('admin_create_manual_event_booking', {
        p_event_id: event.id,
        p_event_date_id: manualForm.event_date_id || null,
        p_attendee_email: manualForm.email.trim() || null,
        p_attendee_name: manualForm.name.trim(),
        p_ticket_count: manualForm.ticket_count,
        p_payment_reference: manualForm.payment_reference.trim() || null,
        p_amount_cents: isNaN(amountCents) ? 0 : amountCents,
        p_payment_method: manualForm.payment_method,
      });
      if (error) throw error;
      const res = data as any;
      toast.success(`${res?.bookings_created ?? manualForm.ticket_count} bokning(ar) skapad(e)`);
      setManualOpen(false);
      setManualForm({ name: '', email: '', ticket_count: 1, event_date_id: '', payment_reference: '', amount_kr: '', payment_method: 'swish' });
      await refreshAll();
    } catch (e: any) {
      toast.error(`Misslyckades: ${e?.message ?? 'okänt fel'}`);
    } finally {
      setManualSaving(false);
    }
  };

  const isPast = event?.end_at ? new Date(event.end_at) < new Date() : event?.start_at ? new Date(event.start_at) < new Date() : false;

  useEffect(() => {
    if (!open || !event) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSearch('');
      setDateFilter('all');
      setExpanded(new Set());

      const [bkRes, ciRes, dtRes] = await Promise.all([
        supabase
          .from('event_bookings')
          .select('*, profiles:member_id(id, full_name, email, avatar_url)')
          .eq('event_id', event.id)
          .order('booked_at', { ascending: false }),
        supabase.from('event_checkins').select('*').eq('event_id', event.id),
        supabase.from('event_dates').select('*').eq('event_id', event.id).order('start_at'),
      ]);

      if (cancelled) return;

      const bks = (bkRes.data || []) as BookingRow[];
      setBookings(bks);
      setCheckins(ciRes.data || []);
      setDates(dtRes.data || []);

      // Resolve payments: match by member_id + booking time window (±2h)
      const memberIds = Array.from(new Set(bks.map((b) => b.member_id)));
      const map: Record<string, { cents: number; method: 'stripe' | 'swish' }> = {};

      if (memberIds.length > 0) {
        const [stripeRes, swishRes] = await Promise.all([
          supabase
            .from('payments')
            .select('member_id, amount_cents, created_at, description, status')
            .in('member_id', memberIds),
          supabase
            .from('swish_payments')
            .select('member_id, amount_cents, created_at, metadata, status, payment_type')
            .in('member_id', memberIds),
        ]);

        const tryAttach = (memberId: string, cents: number, method: 'stripe' | 'swish', paidAt: string, bookedAt: string) => {
          const diff = Math.abs(new Date(paidAt).getTime() - new Date(bookedAt).getTime());
          if (diff > 1000 * 60 * 60 * 6) return false; // 6h window
          const key = `${memberId}`;
          if (!map[key] || diff < (map[key] as any)._diff) {
            map[key] = { cents, method };
            (map[key] as any)._diff = diff;
          }
          return true;
        };

        for (const b of bks) {
          const stripeMatches = (stripeRes.data || []).filter((p) => p.member_id === b.member_id && (p.status || '').toLowerCase() !== 'failed');
          for (const p of stripeMatches) tryAttach(b.member_id, p.amount_cents, 'stripe', p.created_at, b.booked_at);

          const swishMatches = (swishRes.data || []).filter((p) => p.member_id === b.member_id && (p.status || '').toLowerCase() === 'paid');
          for (const p of swishMatches) tryAttach(b.member_id, p.amount_cents, 'swish', p.created_at, b.booked_at);
        }
      }

      setPaymentsByMember(map);

      // Load any Swish payments for this event with no matching booking (drift detector)
      const { data: drift } = await supabase.rpc('admin_list_unreconciled_swish_for_event', {
        p_event_id: event.id,
      });
      if (!cancelled) setUnreconciled((drift as any[]) || []);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, event]);

  const reconcileOne = async (swishPaymentId: string) => {
    setReconciling(swishPaymentId);
    try {
      const { data, error } = await supabase.rpc('admin_reconcile_swish_event_booking', {
        p_swish_payment_id: swishPaymentId,
        p_attendee_names: [],
      });
      if (error) throw error;
      const res = data as any;
      toast.success(
        res?.already_existed
          ? 'Redan bokad'
          : `Bokning skapad (${res?.bookings_created ?? 0} st)`
      );
      // Refresh
      if (event) {
        const [bkRes, drift] = await Promise.all([
          supabase
            .from('event_bookings')
            .select('*, profiles:member_id(id, full_name, email, avatar_url)')
            .eq('event_id', event.id)
            .order('booked_at', { ascending: false }),
          supabase.rpc('admin_list_unreconciled_swish_for_event', { p_event_id: event.id }),
        ]);
        setBookings((bkRes.data || []) as BookingRow[]);
        setUnreconciled((drift.data as any[]) || []);
      }
    } catch (e: any) {
      toast.error(`Reconcile failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setReconciling(null);
    }
  };

  // Filter check-ins by selected date
  const filteredCheckins = useMemo(() => {
    if (dateFilter === 'all') return checkins;
    // event_checkins has no date_id link in schema; we approximate via scanned_at being within a date window
    const d = dates.find((x) => x.id === dateFilter);
    if (!d) return checkins;
    const start = new Date(d.start_at).getTime();
    const end = d.end_at ? new Date(d.end_at).getTime() : start + 1000 * 60 * 60 * 12;
    return checkins.filter((c) => {
      const t = new Date(c.scanned_at).getTime();
      return t >= start - 1000 * 60 * 60 && t <= end + 1000 * 60 * 60 * 2;
    });
  }, [checkins, dateFilter, dates]);

  const rows: ResolvedRow[] = useMemo(() => {
    return bookings.map((b) => {
      const perDate: Record<string, number> = {};
      for (const d of dates) {
        const start = new Date(d.start_at).getTime();
        const end = d.end_at ? new Date(d.end_at).getTime() : start + 1000 * 60 * 60 * 12;
        perDate[d.id] = checkins.filter(
          (c) => c.booking_id === b.id && new Date(c.scanned_at).getTime() >= start - 1000 * 60 * 60 && new Date(c.scanned_at).getTime() <= end + 1000 * 60 * 60 * 2
        ).length;
      }
      const pay = paymentsByMember[b.member_id];
      return {
        booking: b,
        paidCents: pay?.cents ?? null,
        method: pay?.method ?? null,
        perDateCheckins: perDate,
      };
    });
  }, [bookings, paymentsByMember, checkins, dates]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      const name = r.booking.profiles?.full_name?.toLowerCase() || '';
      const email = r.booking.profiles?.email?.toLowerCase() || '';
      const attendees = (r.booking.attendee_names as any[] | null)?.join(' ').toLowerCase() || '';
      return name.includes(q) || email.includes(q) || attendees.includes(q);
    });
  }, [rows, search]);

  // Stats (over active bookings only, filtered by date if applicable)
  const stats = useMemo(() => {
    const active = rows.filter((r) => ACTIVE.has(r.booking.status));
    const sold = active.reduce((s, r) => s + (r.booking.ticket_count || 1), 0);
    const revenue = active.reduce((s, r) => s + (r.paidCents || 0), 0);

    let checkedIn = 0;
    if (dateFilter === 'all') {
      checkedIn = active.reduce((s, r) => s + (r.booking.checkins_used || 0), 0);
    } else {
      checkedIn = active.reduce((s, r) => s + (r.perDateCheckins[dateFilter] || 0), 0);
    }

    // expected for date filter = sold (each ticket should check in on each date for multi-day)
    const expected = sold;
    const noShow = Math.max(0, expected - checkedIn);
    const pct = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;

    return { sold, revenue, checkedIn, noShow, pct, expected };
  }, [rows, dateFilter]);

  const exportCsv = () => {
    if (!event) return;
    const headers = ['Köpare', 'E-post', 'Antal biljetter', 'Deltagare', 'Betalat (kr)', 'Metod', 'Bokad', 'Status', 'Incheckningar'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const b = r.booking;
      const attendees = ((b.attendee_names as any[] | null) || []).join(' / ');
      const row = [
        b.profiles?.full_name || '',
        b.profiles?.email || '',
        String(b.ticket_count || 1),
        attendees,
        r.paidCents != null ? (r.paidCents / 100).toFixed(2) : '',
        r.method || '',
        format(new Date(b.booked_at), 'yyyy-MM-dd HH:mm'),
        b.status,
        `${b.checkins_used}/${b.checkins_allowed}`,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendees-${(event.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${format(new Date(), 'yyyyMMdd')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusBadge = (status: string) => {
    const v: Record<string, { label: string; cls: string }> = {
      confirmed: { label: 'Bekräftad', cls: 'bg-primary/15 text-primary border border-primary/30' },
      checked_in: { label: 'Incheckad', cls: 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30' },
      cancelled: { label: 'Avbokad', cls: 'bg-muted text-muted-foreground' },
      refunded: { label: 'Återbetalad', cls: 'bg-destructive/15 text-destructive border border-destructive/30' },
    };
    const s = v[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPast ? <BarChart3 className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5" />}
            {isPast ? 'Eventrapport' : 'Deltagarlista'} — {event?.title}
          </DialogTitle>
          <DialogDescription>
            {isPast
              ? `${stats.checkedIn} av ${stats.expected} dök upp (${stats.pct}%)`
              : `${stats.sold} sålda biljetter, ${stats.revenue > 0 ? fmtKr(stats.revenue) : '—'} i intäkt`}
          </DialogDescription>
        </DialogHeader>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <StatCard icon={<TicketIcon className="h-4 w-4" />} label="Sålda biljetter" value={String(stats.sold)} sub={`${bookings.filter((b) => ACTIVE.has(b.status)).length} köpare`} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Intäkt" value={fmtKr(stats.revenue)} sub={stats.sold > 0 ? `Ø ${fmtKr(Math.round(stats.revenue / stats.sold))}/biljett` : undefined} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Incheckade" value={String(stats.checkedIn)} sub={`${stats.pct}% närvaro`} tone="success" />
          <StatCard icon={<AlertCircle className="h-4 w-4" />} label="No-show" value={String(stats.noShow)} sub={stats.expected > 0 ? `${100 - stats.pct}% av sålda` : undefined} tone={stats.noShow > 0 && isPast ? 'warn' : 'default'} />
        </div>

        {/* Unreconciled Swish payments (paid but no booking) */}
        {unreconciled.length > 0 && (
          <div className="mt-4 border border-amber-500/40 bg-amber-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <p className="text-sm font-semibold text-amber-900">
                Betalt men ej bokat ({unreconciled.length})
              </p>
            </div>
            <p className="text-xs text-amber-900/80 mb-3">
              Dessa medlemmar har betalat via Swish men deras bokning skapades aldrig (t.ex. webbläsaren stängdes innan bekräftelsesidan laddades). Klicka för att skapa bokningen manuellt — QR-kod genereras automatiskt.
            </p>
            <div className="space-y-2">
              {unreconciled.map((u) => (
                <div key={u.swish_payment_id} className="flex items-center gap-3 bg-background rounded-md p-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{u.member_name || u.customer_name || 'Okänd medlem'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.member_email || '—'} · {fmtKr(u.amount_cents)} · {u.quantity} biljett(er) · Swish #{u.wp_order_id || '—'} · {format(new Date(u.created_at), 'd MMM HH:mm')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => reconcileOne(u.swish_payment_id)}
                    disabled={reconciling === u.swish_payment_id}
                  >
                    {reconciling === u.swish_payment_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Skapa bokning'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök namn, e-post eller deltagare…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {dates.length > 1 && (
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla datum</SelectItem>
                {dates.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {format(new Date(d.start_at), 'd MMM HH:mm')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Manuell bokning
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Exportera CSV
          </Button>
        </div>

        {/* Rows */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Laddar…</div>
          ) : visibleRows.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Inga deltagare ännu</p>
            </div>
          ) : (
            visibleRows.map((r) => {
              const b = r.booking;
              const isExpanded = expanded.has(b.id);
              const attendeeNames = ((b.attendee_names as any[] | null) || []).filter(Boolean);
              const allCheckedIn = b.checkins_used >= b.checkins_allowed;
              const noneCheckedIn = b.checkins_used === 0;
              const checkInIcon = allCheckedIn ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : noneCheckedIn ? (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              );

              return (
                <Card key={b.id} className="shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(b.id)}
                      className="w-full text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {b.profiles?.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{b.profiles?.full_name || 'Okänd'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.profiles?.email || '—'} · bokad {format(new Date(b.booked_at), 'd MMM HH:mm')}
                        </p>
                      </div>

                      <div className="hidden sm:flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="font-mono">{b.ticket_count} × biljett</Badge>
                      </div>

                      <div className="hidden md:flex items-center gap-2 text-sm min-w-[110px] justify-end">
                        {r.paidCents != null ? (
                          <>
                            {r.method === 'swish' ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground" /> : <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="font-semibold">{fmtKr(r.paidCents)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ingen betalning</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-2">
                        {checkInIcon}
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {b.checkins_used}/{b.checkins_allowed}
                        </span>
                      </div>
                      <div className="ml-2">{statusBadge(b.status)}</div>
                      <div className="ml-1 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-3 sm:p-4 space-y-3">
                        {attendeeNames.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Deltagare</p>
                            <div className="flex flex-wrap gap-1.5">
                              {attendeeNames.map((n: string, i: number) => (
                                <Badge key={i} variant="secondary" className="font-normal">{n}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {dates.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Incheckning per datum</p>
                            <div className="flex flex-wrap gap-1.5">
                              {dates.map((d) => {
                                const count = r.perDateCheckins[d.id] || 0;
                                const ok = count >= b.ticket_count;
                                return (
                                  <span
                                    key={d.id}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                                      ok ? 'bg-emerald-500/10 text-emerald-700' : count > 0 ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {format(new Date(d.start_at), 'd MMM')} · {count}/{b.ticket_count}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <span>Bokat: <strong className="text-foreground">{format(new Date(b.booked_at), 'yyyy-MM-dd HH:mm')}</strong></span>
                          <span>Betalningsstatus: <strong className="text-foreground">{b.payment_status}</strong></span>
                          {b.payment_reference && <span>Ref: <code className="text-foreground">{b.payment_reference}</code></span>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>

      {/* Manual booking dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lägg till manuell bokning</DialogTitle>
            <DialogDescription>
              Använd när någon har betalat utanför systemet (t.ex. Swish via WordPress) men bokningen inte registrerades automatiskt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Namn *</Label>
              <Input id="m-name" value={manualForm.name} onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))} placeholder="Förnamn Efternamn" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-email">E-post (valfri)</Label>
              <Input id="m-email" type="email" value={manualForm.email} onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))} placeholder="namn@example.com" />
              <p className="text-xs text-muted-foreground">Om medlemmen finns kopplas bokningen till deras konto.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-count">Antal biljetter</Label>
                <Input id="m-count" type="number" min={1} max={20} value={manualForm.ticket_count} onChange={(e) => setManualForm((f) => ({ ...f, ticket_count: Math.max(1, parseInt(e.target.value || '1', 10)) }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-amount">Belopp (kr)</Label>
                <Input id="m-amount" inputMode="decimal" value={manualForm.amount_kr} onChange={(e) => setManualForm((f) => ({ ...f, amount_kr: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {dates.length > 0 && (
              <div className="space-y-1.5">
                <Label>Datum (valfritt)</Label>
                <Select value={manualForm.event_date_id || 'none'} onValueChange={(v) => setManualForm((f) => ({ ...f, event_date_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Alla datum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alla / inget specifikt datum</SelectItem>
                    {dates.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{format(new Date(d.start_at), 'd MMM HH:mm')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Betalmetod</Label>
                <Select value={manualForm.payment_method} onValueChange={(v: any) => setManualForm((f) => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swish">Swish</SelectItem>
                    <SelectItem value="stripe">Stripe / kort</SelectItem>
                    <SelectItem value="cash">Kontant</SelectItem>
                    <SelectItem value="other">Övrigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-ref">Referens (valfri)</Label>
                <Input id="m-ref" value={manualForm.payment_reference} onChange={(e) => setManualForm((f) => ({ ...f, payment_reference: e.target.value }))} placeholder="Swish # / ordernr" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)} disabled={manualSaving}>Avbryt</Button>
            <Button onClick={submitManual} disabled={manualSaving || !manualForm.name.trim()}>
              {manualSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Skapa bokning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>

  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success' | 'warn';
}) {
  const toneCls =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'warn'
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-primary/20 bg-primary/5';
  return (
    <Card className={`shadow-none ${toneCls}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
