import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Mail, Phone, Award, DollarSign, ShoppingBag, Clock, X, Edit, Trash2, UserCog, CheckCircle, CalendarIcon, Gift } from 'lucide-react';
import { format } from 'date-fns';

interface MemberDetailDrawerProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const levelColors = {
  bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  silver: 'bg-slate-200 text-slate-800 border-slate-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
  vip: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function MemberDetailDrawer({ memberId, open, onOpenChange }: MemberDetailDrawerProps) {
  const { t } = useLanguageStore();
  const { userId } = useAuthStore();
  const queryClient = useQueryClient();
  
  // State
  const [newNote, setNewNote] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [ticketCount, setTicketCount] = useState<string>('1');
  const [ticketExpiry, setTicketExpiry] = useState<Date | undefined>(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 3 months from now
  );
  const [ticketSourceCourseId, setTicketSourceCourseId] = useState<string>('__none__');
  const [removeTicketCount, setRemoveTicketCount] = useState<string>('1');
  const [newRole, setNewRole] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
  });
  const [checkinForm, setCheckinForm] = useState({
    course_id: '',
    note: '',
  });
  // Event ticket state
  const [eventTicketEventId, setEventTicketEventId] = useState<string>('');
  const [eventTicketDateId, setEventTicketDateId] = useState<string>('__all__');
  const [eventTicketCount, setEventTicketCount] = useState<string>('1');
  const [compCodePercent, setCompCodePercent] = useState<string>('100');
  // Unified target selector for give/remove
  const [ticketTarget, setTicketTarget] = useState<'dropin' | 'course' | 'event'>('dropin');
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);


  // Fetch member profile
  const { data: profile } = useQuery({
    queryKey: ['member-profile', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch member role from user_roles table
  const { data: memberRole } = useQuery({
    queryKey: ['member-role', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', memberId)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const role = data ? (data as any).role : 'member';
      return role as string;
    },
    enabled: open,
  });

  // Fetch courses (used in quick actions: course picker & manual check-in)
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-admin-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, starts_at')
        .order('starts_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch events + dates for event ticket gifting
  const { data: events = [] } = useQuery({
    queryKey: ['events-for-admin-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_at, status, event_dates(id, start_at)')
        .eq('status', 'published')
        .order('start_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const selectedEvent = events.find((e: any) => e.id === eventTicketEventId);
  const eventDates: any[] = (selectedEvent?.event_dates || []).slice().sort(
    (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  // Fetch Stripe payments for this member
  const { data: stripePayments = [] } = useQuery({
    queryKey: ['member-stripe-payments', memberId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-payments?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch payments');
      const json = await res.json();
      // Filter to this member only, paid status
      return (json.payments || []).filter(
        (p: any) => p.userId === memberId
      );
    },
    enabled: open,
  });

  // Compute revenue stats from Stripe data
  const revenue = (() => {
    const paidPayments = stripePayments.filter((p: any) => p.status === 'paid');
    const revenueCents = paidPayments.reduce((sum: number, p: any) => sum + Math.round(p.amountSEK * 100), 0);
    const lastPaidAt = paidPayments.length > 0
      ? paidPayments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt
      : null;
    return {
      revenue_cents: revenueCents,
      txn_count: paidPayments.length,
      last_paid_at: lastPaidAt,
    };
  })();

  // Fetch tickets & checkins
  const { data: tickets = [] } = useQuery({
    queryKey: ['member-tickets', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          source_course:courses!source_course_id(title, price_cents)
        `)
        .eq('member_id', memberId)
        .order('purchased_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch member's active event bookings (for cancellation UI)
  const { data: memberEventBookings = [] } = useQuery({
    queryKey: ['member-event-bookings', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_bookings')
        .select('id, event_id, event_date_id, ticket_count, status, attendee_names, events(title, start_at), event_dates(start_at)')
        .eq('member_id', memberId)
        .in('status', ['confirmed', 'checked_in'])
        .order('booked_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });



  // Fetch subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['member-subs', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch notes
  const { data: notes = [] } = useQuery({
    queryKey: ['member-notes', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_notes')
        .select(`
          *,
          author:profiles!author_id(full_name)
        `)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch checkin stats
  const { data: checkinStats } = useQuery({
    queryKey: ['member-checkins', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_member_checkins')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Give free tickets mutation
  const giveTicketsMutation = useMutation({
    mutationFn: async (data: { ticketCount: number; expiresAt?: string; sourceCourseId?: string | null }) => {
      const { data: result, error } = await supabase.rpc("admin_give_free_tickets" as any, {
        p_member_id: memberId,
        p_ticket_count: data.ticketCount,
        p_expires_at: data.expiresAt,
        p_source_course_id: data.sourceCourseId ?? null,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(t.common.ticketsGiven.replace("{count}", result.tickets.toString()));
      setTicketCount("1");
      setTicketSourceCourseId("__none__");
      queryClient.invalidateQueries({ queryKey: ["member-tickets", memberId] });
    },
    onError: (error: any) => {
      console.error("Give tickets error:", error);
      toast.error("Kunde inte ge klipp: " + error.message);
    },
  });

  // Give free event booking
  const giveEventTicketMutation = useMutation({
    mutationFn: async (data: { eventId: string; eventDateId: string | null; ticketCount: number }) => {
      const { data: result, error } = await supabase.rpc("admin_create_free_event_booking" as any, {
        p_member_id: memberId,
        p_event_id: data.eventId,
        p_event_date_id: data.eventDateId,
        p_ticket_count: data.ticketCount,
        p_attendee_names: [],
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(
        (t.crm.actions as any).eventBookingCreated.replace("{event}", result.event_title || "")
      );
      setEventTicketCount("1");
      queryClient.invalidateQueries({ queryKey: ["member-event-bookings", memberId] });
    },
    onError: (error: any) => {
      console.error("Event booking error:", error);
      toast.error(error.message || t.crm.error);
    },
  });

  // Generate event comp code
  const generateCompCodeMutation = useMutation({
    mutationFn: async (data: { eventId: string | null; percentOff: number }) => {
      const code = `COMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { error } = await supabase.from("event_comp_codes" as any).insert({
        code,
        event_id: data.eventId,
        percent_off: data.percentOff,
        max_uses: 1,
        created_by: userId!,
        created_for: memberId,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      return code;
    },
    onSuccess: async (code: string) => {
      try { await navigator.clipboard.writeText(code); } catch {}
      toast.success((t.crm.actions as any).compCodeCreated.replace("{code}", code));
    },
    onError: (error: any) => {
      console.error("Comp code error:", error);
      toast.error(error.message || t.crm.error);
    },
  });

  // Remove tickets mutation
  const removeTicketsMutation = useMutation({
    mutationFn: async (data: { ticketCount: number; sourceCourseId?: string | null }) => {
      const { data: result, error } = await supabase.rpc("admin_remove_tickets" as any, {
        p_member_id: memberId,
        p_ticket_count: data.ticketCount,
        p_source_course_id: data.sourceCourseId ?? null,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(t.common.ticketsRemoved.replace("{count}", result.tickets_removed.toString()));
      setRemoveTicketCount("1");
      queryClient.invalidateQueries({ queryKey: ["member-tickets", memberId] });
    },
    onError: (error: any) => {
      console.error("Remove tickets error:", error);
      if (error.message?.includes("NOT_ENOUGH_TICKETS")) {
        toast.error(t.common.notEnoughTickets);
      } else {
        toast.error("Kunde inte ta bort klipp: " + error.message);
      }
    },
  });

  // Cancel event booking mutation
  const cancelEventBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data: result, error } = await supabase.rpc("admin_cancel_event_booking" as any, {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(
        ((t.crm.actions as any).bookingCancelled || "Booking cancelled").replace(
          "{event}",
          result.event_title || ""
        )
      );
      setCancelBookingId(null);
      queryClient.invalidateQueries({ queryKey: ["member-event-bookings", memberId] });
    },
    onError: (error: any) => {
      console.error("Cancel booking error:", error);
      toast.error(error.message || t.crm.error);
    },
  });


  // Update member mutation (for level, status)
  const updateMemberMutation = useMutation({
    mutationFn: async (params: { new_level?: string; new_status?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_member', {
        target: memberId,
        new_level: params.new_level,
        new_status: params.new_status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profile', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success(t.crm.updated);
      setNewLevel('');
    },
    onError: () => {
      toast.error(t.crm.error);
    },
  });

  // Update member profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (params: { full_name?: string; email?: string; phone?: string; role?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_member_profile', {
        target_user_id: memberId,
        p_full_name: params.full_name || null,
        p_email: params.email || null,
        p_phone: params.phone || null,
        p_role: params.role as any || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profile', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success(t.crm.updated);
      setEditDialogOpen(false);
      setNewRole('');
    },
    onError: (error: any) => {
      toast.error(error.message || t.crm.error);
    },
  });

  // Delete member mutation (uses edge function to remove auth user too)
  const deleteMemberMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-delete-member', {
        body: { user_id: memberId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Member deleted successfully');
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t.crm.error);
    },
  });

  // Manual check-in mutation
  const manualCheckinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_manual_checkin', {
        p_member_id: memberId,
        p_course_id: checkinForm.course_id,
        p_note: checkinForm.note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-tickets', memberId] });
      queryClient.invalidateQueries({ queryKey: ['member-checkins', memberId] });
      toast.success('Check-in successful');
      setCheckinDialogOpen(false);
      setCheckinForm({ course_id: '', note: '' });
    },
    onError: (error: any) => {
      toast.error(error.message || t.crm.error);
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('member_notes')
        .insert({ member_id: memberId, author_id: userId!, body });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-notes', memberId] });
      toast.success(t.crm.saved);
      setNewNote('');
    },
    onError: () => {
      toast.error(t.crm.error);
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleEditClick = () => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
      setEditDialogOpen(true);
    }
  };

  const handleEditSubmit = () => {
    updateProfileMutation.mutate(editForm);
  };

  const handleRoleChange = async (role: string) => {
    try {
      setNewRole(role);
      
      // First, delete existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles' as any)
        .delete()
        .eq('user_id', memberId);

      if (deleteError) throw deleteError;

      // Then, insert the new role
      const { error: insertError } = await supabase
        .from('user_roles' as any)
        .insert({
          user_id: memberId,
          role: role,
        });

      if (insertError) throw insertError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['member-role', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Role updated successfully');
      setNewRole('');
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleCheckinSubmit = () => {
    if (!checkinForm.course_id) {
      toast.error('Please select a course');
      return;
    }
    manualCheckinMutation.mutate();
  };

  if (!profile) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh]">
          <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
            <DrawerHeader className="border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || ''} alt={profile.full_name} />
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DrawerTitle className="text-xl sm:text-2xl truncate">
                      {profile.full_name || '—'}
                    </DrawerTitle>
                    <DrawerDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className={levelColors[profile.level as keyof typeof levelColors]}>
                        {t.crm.level[profile.level as keyof typeof t.crm.level]}
                      </Badge>
                      <Badge variant="outline">
                        {memberRole || 'member'}
                      </Badge>
                      {profile.email && (
                        <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:underline">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[140px] sm:max-w-none">{profile.email}</span>
                        </a>
                      )}
                      {profile.phone && (
                        <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{profile.phone}</span>
                        </a>
                      )}
                    </DrawerDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <Button variant="outline" size="sm" onClick={handleEditClick} className="flex-1 sm:flex-none">
                    <Edit className="h-4 w-4 mr-2" />
                    {t.crm.actions.edit}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} className="flex-1 sm:flex-none">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t.crm.actions.delete}
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="ghost" size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  </DrawerClose>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  <TabsTrigger value="overview">{t.crm.drawer.overview}</TabsTrigger>
                  <TabsTrigger value="purchases">{t.crm.drawer.purchases}</TabsTrigger>
                  <TabsTrigger value="tickets">{t.crm.drawer.tickets}</TabsTrigger>
                  <TabsTrigger value="subs">{t.crm.drawer.subs}</TabsTrigger>
                  <TabsTrigger value="notes">{t.crm.drawer.notes}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t.crm.total}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(revenue?.revenue_cents || 0)}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t.crm.purchases}</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{revenue?.txn_count || 0}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t.crm.lastActivity}</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          {revenue.last_paid_at
                            ? format(new Date(revenue.last_paid_at), 'yyyy-MM-dd')
                            : checkinStats?.last_checkin_at
                              ? format(new Date(checkinStats.last_checkin_at), 'yyyy-MM-dd')
                              : '—'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.dashboard.quickActions}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* ============ Unified ticket / event management ============ */}
                      <div className="space-y-4 rounded-lg border p-3 sm:p-4 bg-muted/20">
                        {/* Current state summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              {(t.crm.actions as any).currentClips}
                            </Label>
                            {(() => {
                              const valid = (tickets as any[]).filter(
                                (tk) => tk.status === 'valid' && tk.total_tickets > tk.tickets_used && (!tk.expires_at || new Date(tk.expires_at) > new Date())
                              );
                              if (valid.length === 0) {
                                return <p className="text-xs text-muted-foreground mt-1">{(t.crm.actions as any).noClips}</p>;
                              }
                              const groups: Record<string, { name: string; count: number }> = {};
                              valid.forEach((tk) => {
                                const key = tk.source_course_id || '__dropin__';
                                const name = tk.source_course?.title || (t.crm.actions as any).targetDropIn;
                                const remaining = tk.total_tickets - tk.tickets_used;
                                if (!groups[key]) groups[key] = { name, count: 0 };
                                groups[key].count += remaining;
                              });
                              return (
                                <ul className="text-xs mt-1 space-y-0.5">
                                  {Object.values(groups).map((g, i) => (
                                    <li key={i} className="flex justify-between gap-2">
                                      <span className="truncate">{g.name}</span>
                                      <span className="font-medium">{g.count}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">
                              {(t.crm.actions as any).currentEventBookings}
                            </Label>
                            {(memberEventBookings as any[]).length === 0 ? (
                              <p className="text-xs text-muted-foreground mt-1">{(t.crm.actions as any).noEventBookings}</p>
                            ) : (
                              <ul className="text-xs mt-1 space-y-1">
                                {(memberEventBookings as any[]).map((b) => {
                                  const dateStr = b.event_dates?.start_at || b.events?.start_at;
                                  return (
                                    <li key={b.id} className="flex items-center justify-between gap-2">
                                      <span className="truncate">
                                        {b.events?.title || '—'}
                                        {dateStr ? ` · ${format(new Date(dateStr), 'yyyy-MM-dd')}` : ''}
                                        {b.ticket_count > 1 ? ` (×${b.ticket_count})` : ''}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={() => setCancelBookingId(b.id)}
                                        disabled={cancelEventBookingMutation.isPending}
                                      >
                                        {(t.crm.actions as any).cancelBooking}
                                      </Button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Target selector */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{(t.crm.actions as any).ticketTarget}</Label>
                          <Select value={ticketTarget} onValueChange={(v: any) => setTicketTarget(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dropin">{(t.crm.actions as any).targetDropIn}</SelectItem>
                              <SelectItem value="course">{(t.crm.actions as any).targetCourse}</SelectItem>
                              <SelectItem value="event">{(t.crm.actions as any).targetEvent}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Course picker */}
                        {ticketTarget === 'course' && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{(t.crm.actions as any).selectCourse}</Label>
                            <Select
                              value={ticketSourceCourseId === '__none__' ? '' : ticketSourceCourseId}
                              onValueChange={setTicketSourceCourseId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={(t.crm.actions as any).selectCourse} />
                              </SelectTrigger>
                              <SelectContent>
                                {courses.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Event picker */}
                        {ticketTarget === 'event' && (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{(t.crm.actions as any).selectEvent}</Label>
                              <Select
                                value={eventTicketEventId}
                                onValueChange={(v) => { setEventTicketEventId(v); setEventTicketDateId('__all__'); }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={(t.crm.actions as any).selectEvent} />
                                </SelectTrigger>
                                <SelectContent>
                                  {events.map((e: any) => (
                                    <SelectItem key={e.id} value={e.id}>
                                      {e.title}{e.start_at ? ` – ${format(new Date(e.start_at), 'yyyy-MM-dd')}` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {eventDates.length > 1 && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{(t.crm.actions as any).selectEventDate}</Label>
                                <Select value={eventTicketDateId} onValueChange={setEventTicketDateId}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__all__">{(t.crm.actions as any).allDates}</SelectItem>
                                    {eventDates.map((d: any) => (
                                      <SelectItem key={d.id} value={d.id}>
                                        {format(new Date(d.start_at), 'yyyy-MM-dd HH:mm')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Count + (expiry for non-event) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {ticketTarget === 'event' ? (t.crm.actions as any).attendees : t.common.ticketCount}
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              value={ticketTarget === 'event' ? eventTicketCount : ticketCount}
                              onChange={(e) =>
                                ticketTarget === 'event'
                                  ? setEventTicketCount(e.target.value)
                                  : setTicketCount(e.target.value)
                              }
                            />
                          </div>
                          {ticketTarget !== 'event' && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{t.common.ticketExpiry}</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {ticketExpiry ? format(ticketExpiry, "PPP") : <span>—</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={ticketExpiry}
                                    onSelect={setTicketExpiry}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>

                        {/* Give / Remove buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => {
                              if (ticketTarget === 'event') {
                                giveEventTicketMutation.mutate({
                                  eventId: eventTicketEventId,
                                  eventDateId: eventTicketDateId !== '__all__' ? eventTicketDateId : null,
                                  ticketCount: parseInt(eventTicketCount) || 1,
                                });
                              } else {
                                giveTicketsMutation.mutate({
                                  ticketCount: parseInt(ticketCount),
                                  expiresAt: ticketExpiry?.toISOString(),
                                  sourceCourseId: ticketTarget === 'course' && ticketSourceCourseId && ticketSourceCourseId !== '__none__'
                                    ? ticketSourceCourseId
                                    : null,
                                });
                              }
                            }}
                            disabled={
                              (ticketTarget === 'event' && (!eventTicketEventId || giveEventTicketMutation.isPending)) ||
                              (ticketTarget === 'course' && (!ticketSourceCourseId || ticketSourceCourseId === '__none__')) ||
                              (ticketTarget !== 'event' && (!ticketCount || parseInt(ticketCount) < 1)) ||
                              giveTicketsMutation.isPending
                            }
                          >
                            <Gift className="h-4 w-4 mr-2" />
                            {(t.crm.actions as any).give}
                          </Button>
                          {ticketTarget !== 'event' && (
                            <>
                              <Input
                                type="number"
                                min="1"
                                max="50"
                                value={removeTicketCount}
                                onChange={(e) => setRemoveTicketCount(e.target.value)}
                                className="w-full sm:w-24"
                              />
                              <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() =>
                                  removeTicketsMutation.mutate({
                                    ticketCount: parseInt(removeTicketCount),
                                    sourceCourseId: ticketTarget === 'course' && ticketSourceCourseId && ticketSourceCourseId !== '__none__'
                                      ? ticketSourceCourseId
                                      : null,
                                  })
                                }
                                disabled={
                                  !removeTicketCount ||
                                  parseInt(removeTicketCount) < 1 ||
                                  (ticketTarget === 'course' && (!ticketSourceCourseId || ticketSourceCourseId === '__none__')) ||
                                  removeTicketsMutation.isPending
                                }
                              >
                                {(t.crm.actions as any).remove}
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Comp code (only for events) */}
                        {ticketTarget === 'event' && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="%"
                              value={compCodePercent}
                              onChange={(e) => setCompCodePercent(e.target.value)}
                              className="w-full sm:w-24"
                            />
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() =>
                                generateCompCodeMutation.mutate({
                                  eventId: eventTicketEventId || null,
                                  percentOff: Math.min(100, Math.max(1, parseInt(compCodePercent) || 100)),
                                })
                              }
                              disabled={generateCompCodeMutation.isPending}
                            >
                              {(t.crm.actions as any).generateCompCode}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


                        {/* Change role */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.crm.actions.changeRole}</label>
                          <Select value={newRole || memberRole || 'member'} onValueChange={handleRoleChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t.crm.selectRole} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">{t.roles.MEDLEM}</SelectItem>
                              <SelectItem value="instructor">{t.roles.INSTRUKTOR}</SelectItem>
                              <SelectItem value="admin">{t.roles.ADMIN}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Manual check-in */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.crm.actions.manualCheckin}</label>
                          <Button
                            variant="outline"
                            onClick={() => setCheckinDialogOpen(true)}
                            className="w-full"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {t.crm.actions.manualCheckin}
                          </Button>
                        </div>
                      </div>

                      {/* Toggle status */}
                      <div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() =>
                            updateMemberMutation.mutate({
                              new_status: profile.status === 'active' ? 'inactive' : 'active',
                            })
                          }
                          disabled={updateMemberMutation.isPending}
                        >
                          {profile.status === 'active'
                            ? t.crm.actions.disable
                            : t.crm.actions.enable}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="purchases">
                  <Card>
                    <CardContent className="pt-6">
                      {stripePayments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>
                      ) : (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                          <Table className="min-w-[600px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t.events.date}</TableHead>
                                <TableHead>{t.course.description}</TableHead>
                                <TableHead className="text-right">{t.courses.price}</TableHead>
                                <TableHead>{t.events.paymentStatus}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stripePayments.map((payment: any) => (
                                <TableRow key={payment.id}>
                                  <TableCell>{format(new Date(payment.createdAt), 'yyyy-MM-dd')}</TableCell>
                                  <TableCell>{payment.description || '—'}</TableCell>
                                  <TableCell className="text-right">
                                    {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(payment.amountSEK)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={payment.status === 'paid' ? 'default' : 'secondary'}
                                    >
                                      {payment.status === 'paid' ? 'Betald' : payment.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tickets">
                  <Card>
                    <CardContent className="pt-6">
                      {tickets.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>
                      ) : (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                          <Table className="min-w-[600px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t.tickets.fromCourse}</TableHead>
                                <TableHead>{t.tickets.ticketsRemaining}</TableHead>
                                <TableHead>{t.tickets.purchasedOn}</TableHead>
                                <TableHead>{t.tickets.expiresAt}</TableHead>
                                <TableHead>{t.courses.price}</TableHead>
                                <TableHead>{t.tickets.checkInStatus}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tickets.map((ticket: any) => {
                                const isAdminGift = ticket.order_id?.startsWith('admin_gift:');
                                const isExpired = ticket.expires_at && new Date(ticket.expires_at) < new Date();
                                const statusColor = 
                                  ticket.status === 'used' ? 'text-muted-foreground' :
                                  isExpired ? 'text-destructive' :
                                  'text-green-600';
                                const statusText = 
                                  ticket.status === 'used' ? t.tickets.expired :
                                  isExpired ? t.tickets.expired :
                                  '✓ Valid';
                                
                                return (
                                  <TableRow key={ticket.id}>
                                    <TableCell>
                                      {isAdminGift ? (
                                        <div className="flex items-center gap-2">
                                          <span>🎁</span>
                                          <span className="text-sm font-medium">{t.crm.adminGift}</span>
                                        </div>
                                      ) : (
                                        ticket.source_course?.title || '—'
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-medium">
                                        {ticket.tickets_used} / {ticket.total_tickets}
                                      </span>
                                      <span className="text-muted-foreground text-sm ml-2">
                                        ({ticket.total_tickets - ticket.tickets_used} {t.tickets.remainingTickets})
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {format(new Date(ticket.purchased_at), 'yyyy-MM-dd')}
                                    </TableCell>
                                    <TableCell>
                                      {ticket.expires_at ? format(new Date(ticket.expires_at), 'yyyy-MM-dd') : '—'}
                                    </TableCell>
                                    <TableCell>
                                      {isAdminGift ? (
                                        <span className="text-green-600 font-medium">{t.crm.freeTicket}</span>
                                      ) : (
                                        formatCurrency(ticket.source_course?.price_cents || 0)
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className={statusColor}>{statusText}</span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="subs">
                  <Card>
                    <CardContent className="pt-6">
                      {subscriptions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>
                      ) : (
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                          <Table className="min-w-[520px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t.memberships.plans}</TableHead>
                                <TableHead>{t.events.bookingStatus}</TableHead>
                                <TableHead>{t.memberships.nextBilling}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subscriptions.map((sub) => (
                                <TableRow key={sub.id}>
                                  <TableCell>{sub.plan}</TableCell>
                                  <TableCell>
                                    <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                                      {sub.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {sub.current_period_end
                                      ? format(new Date(sub.current_period_end), 'yyyy-MM-dd')
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.crm.addNote}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder={t.crm.noteBody}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <Button
                        onClick={() => addNoteMutation.mutate(newNote)}
                        disabled={!newNote.trim() || addNoteMutation.isPending}
                      >
                        {t.common.save}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      {notes.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">{t.crm.noNotes}</p>
                      ) : (
                        <div className="space-y-4">
                          {notes.map((note: any) => (
                            <div key={note.id} className="border-b pb-4 last:border-0">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium">{note.author?.full_name || '—'}</span>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(note.created_at), 'yyyy-MM-dd HH:mm')}
                                </span>
                              </div>
                              <p className="text-sm">{note.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.crm.editMember}</DialogTitle>
            <DialogDescription>
              Update member profile information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.crm.fullName}</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.crm.email}</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.crm.phone}</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateProfileMutation.isPending}>
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Check-in Dialog */}
      <Dialog open={checkinDialogOpen} onOpenChange={setCheckinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.crm.actions.manualCheckin}</DialogTitle>
            <DialogDescription>
              Check in member to a course manually
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.crm.selectCourse}</Label>
              <Select
                value={checkinForm.course_id}
                onValueChange={(value) => setCheckinForm({ ...checkinForm, course_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.crm.selectCourse} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.crm.checkinNote}</Label>
              <Textarea
                value={checkinForm.note}
                onChange={(e) => setCheckinForm({ ...checkinForm, note: e.target.value })}
                placeholder={t.crm.noteBody}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleCheckinSubmit} disabled={manualCheckinMutation.isPending}>
              {t.crm.actions.manualCheckin}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.crm.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.crm.deleteWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMemberMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.crm.actions.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
