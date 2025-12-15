import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Ticket, Calendar, MapPin, Clock, QrCode, 
  PartyPopper, ShoppingCart, Search, X, Info, Check,
  Users, GraduationCap, ChevronDown, AlertCircle, CalendarDays
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import QRCodeLib from 'qrcode';
import { useLanguageStore } from '@/store/languageStore';
import { useAuthStore } from '@/store/authStore';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { StandaloneTicketPurchaseDialog } from '@/components/StandaloneTicketPurchaseDialog';

interface TicketWithCourse {
  id: string;
  member_id: string;
  course_id: string | null;
  source_course_id: string | null;
  purchased_at: string;
  status: string;
  qr_payload: string;
  total_tickets: number;
  tickets_used: number;
  expires_at: string;
  order_id: string | null;
  courses: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
    description: string | null;
  } | null;
}

interface EventTicket {
  id: string;
  member_id: string;
  event_id: string;
  event_date_id: string | null;
  booked_at: string;
  status: string;
  qr_payload: string;
  payment_status: string;
  ticket_count: number;
  checkins_allowed: number;
  checkins_used: number;
  attendee_names: unknown; // JSON type from database
  events: {
    id: string;
    title: string;
    start_at: string;
    end_at: string | null;
    venue: string;
    description: string;
  };
  event_dates: {
    id: string;
    start_at: string;
    end_at: string | null;
  } | null;
}

interface LessonBooking {
  id: string;
  member_id: string;
  lesson_id: string;
  ticket_type: string;
  checkins_allowed: number;
  checkins_used: number;
  status: string;
  qr_payload: string;
  purchased_at: string;
  course_lessons: {
    id: string;
    title: string | null;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
  };
}

type AllTickets = (TicketWithCourse & { type: 'course' }) | (EventTicket & { type: 'event' });

export default function Biljetter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguageStore();
  const { role } = useAuthStore();
  const isAdmin = role === 'admin';
  
  const [tickets, setTickets] = useState<AllTickets[]>([]);
  const [lessonBookings, setLessonBookings] = useState<LessonBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<AllTickets | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const qrCanvasRef = useRef<{ [key: string]: string }>({});

  // Admin-specific state
  const [adminView, setAdminView] = useState<'courses' | 'events'>('courses');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({
    totalAttendees: 0,
    leaders: 0,
    followers: 0,
    notSet: 0,
    checkedIn: 0
  });
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadAdminCourses();
      loadAdminEvents();
    }
    loadTickets();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedCourse) {
      loadCourseAttendees(selectedCourse);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedEvent) {
      loadEventAttendees(selectedEvent);
    }
  }, [selectedEvent]);

  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) return;

      const channel = supabase
        .channel('tickets_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_bookings',
            filter: `member_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('New event booking detected:', payload);
            loadTickets();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'event_bookings',
            filter: `member_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Event booking updated:', payload);
            loadTickets();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tickets',
            filter: `member_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('New ticket detected:', payload);
            loadTickets();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tickets',
            filter: `member_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Ticket updated:', payload);
            loadTickets();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lesson_bookings',
            filter: `member_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('New lesson booking detected:', payload);
            loadTickets();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'lesson_bookings',
            filter: `member_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Lesson booking updated:', payload);
            loadTickets();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      // Load course tickets
      const { data: courseTickets, error: courseError } = await supabase
        .from('tickets')
        .select(`
          *,
          courses!tickets_source_course_id_fkey (
            id,
            title,
            starts_at,
            ends_at,
            venue,
            description
          )
        `)
        .eq('member_id', user.id)
        .order('purchased_at', { ascending: false });

      if (courseError) throw courseError;

      // Load event tickets with event_dates info
      const { data: eventTickets, error: eventError } = await supabase
        .from('event_bookings')
        .select(`
          *,
          events (
            id,
            title,
            start_at,
            end_at,
            venue,
            description
          ),
          event_dates (
            id,
            start_at,
            end_at
          )
        `)
        .eq('member_id', user.id)
        .order('booked_at', { ascending: false });

      if (eventError) throw eventError;

      // Load lesson bookings (drop-in tickets)
      const { data: lessonBookingsData, error: lessonError } = await supabase
        .from('lesson_bookings')
        .select(`
          *,
          course_lessons (
            id,
            title,
            starts_at,
            ends_at,
            venue
          )
        `)
        .eq('member_id', user.id)
        .order('purchased_at', { ascending: false });

      if (lessonError) throw lessonError;
      setLessonBookings(lessonBookingsData || []);

      // Combine and type tickets
      const allTickets: AllTickets[] = [
        ...(courseTickets || []).map(t => ({ ...t, type: 'course' as const })),
        ...(eventTickets || []).map(t => ({ ...t, type: 'event' as const }))
      ];

      setTickets(allTickets);

      // Pre-generate QR codes for all tickets and lesson bookings
      for (const ticket of allTickets) {
        generateQRCode(ticket.qr_payload);
      }
      for (const booking of (lessonBookingsData || [])) {
        generateQRCode(booking.qr_payload);
      }
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message || 'Kunde inte ladda biljetter',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (payload: string) => {
    if (qrCanvasRef.current[payload]) return;
    
    try {
      const dataUrl = await QRCodeLib.toDataURL(payload, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      qrCanvasRef.current[payload] = dataUrl;
    } catch (error) {
      console.error('QR generation error:', error);
    }
  };

  const openQRModal = async (ticket: AllTickets) => {
    setSelectedTicket(ticket);
    try {
      const dataUrl = await QRCodeLib.toDataURL(ticket.qr_payload, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte generera QR-kod',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
      case 'confirmed':
        return { label: 'Giltig', variant: 'default' as const };
      case 'checked_in':
        return { label: 'Incheckad', variant: 'secondary' as const };
      case 'cancelled':
        return { label: 'Avbruten', variant: 'destructive' as const };
      case 'refunded':
        return { label: 'Återbetald', variant: 'outline' as const };
      default:
        return { label: status, variant: 'outline' as const };
    }
  };

  const handleSelfCheckIn = async (ticket: AllTickets) => {
    setCheckingIn(ticket.id);
    try {
      const { data, error } = await supabase.rpc('check_in_with_qr', {
        qr: ticket.qr_payload,
        p_location: 'Self Check-in',
        p_device_info: navigator.userAgent
      });

      if (error) throw error;

      const result = data as any;

      if (result?.success) {
        sonnerToast.success(
          'Incheckning lyckades!',
          {
            description: `Du är nu incheckad för ${result.is_event ? result.event_title : result.course_title}`
          }
        );
        // Reload tickets to update the UI
        await loadTickets();
      } else {
        sonnerToast.error('Incheckning misslyckades', {
          description: result?.message || 'Ett fel uppstod'
        });
      }
    } catch (error) {
      console.error('Check-in error:', error);
      sonnerToast.error('Ett fel uppstod', {
        description: 'Kunde inte checka in. Försök igen.'
      });
    } finally {
      setCheckingIn(null);
    }
  };

  const canCheckIn = (ticket: AllTickets): boolean => {
    // Events cannot self-check-in - must be scanned by staff at door
    if (ticket.type === 'event') {
      return false;
    }
    // Course tickets can still self-check-in
    return ticket.status === 'valid' && ticket.tickets_used < ticket.total_tickets;
  };

  // Admin data loading functions
  const loadAdminCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, starts_at, ends_at, venue, status')
      .order('starts_at', { ascending: false });
    
    if (!error && data) {
      setCourses(data);
    }
  };

  const loadAdminEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_at, end_at, venue, capacity, sold_count')
      .order('start_at', { ascending: false });
    
    if (!error && data) {
      setEvents(data);
    }
  };

  const loadCourseAttendees = async (courseId: string) => {
    const { data: ticketData, error } = await supabase
      .from('tickets')
      .select(`
        id,
        member_id,
        total_tickets,
        tickets_used,
        expires_at,
        status,
        profiles!inner (
          id,
          full_name,
          email,
          phone,
          dance_role
        )
      `)
      .or(`course_id.eq.${courseId},source_course_id.eq.${courseId}`)
      .eq('status', 'valid');
    
    if (error) {
      console.error('Error loading attendees:', error);
      return;
    }
    
    const { data: checkinData } = await supabase
      .from('checkins')
      .select('ticket_id, tickets!inner(member_id)')
      .in('ticket_id', ticketData?.map(t => t.id) || []);
    
    const attendeeMap = new Map();
    ticketData?.forEach(ticket => {
      const profile = ticket.profiles as any;
      const checkins = checkinData?.filter((c: any) => c.tickets.member_id === ticket.member_id).length || 0;
      
      attendeeMap.set(ticket.member_id, {
        id: ticket.member_id,
        name: profile.full_name || 'Unknown',
        email: profile.email,
        phone: profile.phone,
        danceRole: profile.dance_role,
        ticketsRemaining: ticket.total_tickets - ticket.tickets_used,
        totalCheckins: checkins,
        hasCheckedIn: checkins > 0
      });
    });
    
    const attendeesList = Array.from(attendeeMap.values());
    setAttendees(attendeesList);
    
    const stats = {
      totalAttendees: attendeesList.length,
      leaders: attendeesList.filter((a: any) => a.danceRole === 'leader').length,
      followers: attendeesList.filter((a: any) => a.danceRole === 'follower').length,
      notSet: attendeesList.filter((a: any) => !a.danceRole).length,
      checkedIn: attendeesList.filter((a: any) => a.hasCheckedIn).length
    };
    
    setAttendanceStats(stats);
  };

  const loadEventAttendees = async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_bookings')
      .select(`
        id,
        member_id,
        status,
        booked_at,
        profiles!inner (
          id,
          full_name,
          email,
          phone,
          dance_role
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'confirmed');
    
    if (error) {
      console.error('Error loading event attendees:', error);
      return;
    }
    
    const { data: checkinData } = await supabase
      .from('event_checkins')
      .select('member_id')
      .eq('event_id', eventId);
    
    const checkedInMembers = new Set(checkinData?.map(c => c.member_id) || []);
    
    const attendeesList = data?.map(booking => ({
      id: booking.member_id,
      name: (booking.profiles as any).full_name || 'Unknown',
      email: (booking.profiles as any).email,
      phone: (booking.profiles as any).phone,
      danceRole: (booking.profiles as any).dance_role,
      bookedAt: booking.booked_at,
      hasCheckedIn: checkedInMembers.has(booking.member_id)
    })) || [];
    
    setAttendees(attendeesList);
    
    const stats = {
      totalAttendees: attendeesList.length,
      leaders: attendeesList.filter(a => a.danceRole === 'leader').length,
      followers: attendeesList.filter(a => a.danceRole === 'follower').length,
      notSet: attendeesList.filter(a => !a.danceRole).length,
      checkedIn: attendeesList.filter(a => a.hasCheckedIn).length
    };
    
    setAttendanceStats(stats);
  };

  const filteredTickets = tickets.filter((ticket) => {
    const title = ticket.type === 'course' 
      ? (ticket.courses?.title || 'Free Ticket (Admin Gift)')
      : (ticket.events?.title || 'Event Ticket');
    const matchesSearch = title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-12">{t.common.loading}</div>;
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
          <div className="h-4 bg-muted rounded w-64 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Calculate ticket balance from course tickets
  const ticketPackages = tickets.filter(t => t.type === 'course') as TicketWithCourse[];
  const validPackages = ticketPackages.filter(p => p.status === 'valid' && p.tickets_used < p.total_tickets);
  const totalAvailableTickets = validPackages.reduce((sum, p) => sum + (p.total_tickets - p.tickets_used), 0);
  
  // Separate valid and used/expired lesson bookings
  const validLessonBookings = lessonBookings.filter(b => b.status === 'valid' && b.checkins_used < b.checkins_allowed);
  const historyLessonBookings = lessonBookings.filter(b => b.status === 'used' || b.checkins_used >= b.checkins_allowed);
  
  // Event tickets (with type discriminator)
  const eventTicketsTyped = tickets.filter(t => t.type === 'event') as (EventTicket & { type: 'event' })[];
  const validEventTickets = eventTicketsTyped.filter(e => e.status === 'confirmed' || e.status === 'checked_in');
  
  // History items (used/expired packages)
  const historyPackages = ticketPackages.filter(p => p.status !== 'valid' || p.tickets_used >= p.total_tickets);
  
  // Empty state when user has no tickets (only for non-admins)
  if (tickets.length === 0 && lessonBookings.length === 0 && !isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t.nav.biljetter}</h1>
          <p className="mt-1 text-muted-foreground">
            Inga biljetter ännu
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ticket className="h-12 w-12 text-primary" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Inga biljetter ännu</h3>
                <p className="text-muted-foreground">
                  Du har inga eventbiljetter. Köp en kurs eller biljett till våra kommande event för att komma igång!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button 
                  variant="hero" 
                  size="lg"
                  onClick={() => navigate('/kurser-poang')}
                  className="gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Köp kurser
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate('/event')}
                  className="gap-2"
                >
                  <PartyPopper className="h-5 w-5" />
                  Se event
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openLessonQRModal = async (booking: LessonBooking) => {
    try {
      const dataUrl = await QRCodeLib.toDataURL(booking.qr_payload, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(dataUrl);
      setSelectedTicket(null); // Clear ticket, we're using lesson booking
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte generera QR-kod',
        variant: 'destructive',
      });
    }
  };

  const handleLessonCheckIn = async (booking: LessonBooking) => {
    setCheckingIn(booking.id);
    try {
      const { data, error } = await supabase.rpc('check_in_with_qr', {
        qr: booking.qr_payload,
        p_location: 'Self Check-in',
        p_device_info: navigator.userAgent
      });

      if (error) throw error;

      const result = data as any;

      if (result?.success) {
        sonnerToast.success(
          'Incheckning lyckades!',
          {
            description: `Du är nu incheckad för ${result.lesson_title || booking.course_lessons.title}`
          }
        );
        await loadTickets();
      } else {
        sonnerToast.error('Incheckning misslyckades', {
          description: result?.message || 'Ett fel uppstod'
        });
      }
    } catch (error) {
      console.error('Check-in error:', error);
      sonnerToast.error('Ett fel uppstod', {
        description: 'Kunde inte checka in. Försök igen.'
      });
    } finally {
      setCheckingIn(null);
    }
  };

  // Main view (shows admin section + member tickets)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t.nav.biljetter}</h1>
          <p className="mt-1 text-muted-foreground">
            Hantera dina klippkort och evenemangsbiljetter
          </p>
        </div>
        <Button variant="hero" onClick={() => setTicketDialogOpen(true)}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          {t.tickets.buyTickets}
        </Button>
      </div>

      {/* Admin Attendance Management Section - Always visible for admins */}
      {isAdmin && (
        <div className="mb-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t.tickets.adminAttendance || 'Admin: View Attendance'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tab Selection: Courses vs Events */}
              <div className="flex gap-2">
                <Button
                  variant={adminView === 'courses' ? 'default' : 'outline'}
                  onClick={() => setAdminView('courses')}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  {t.nav.courses || 'Courses'}
                </Button>
                <Button
                  variant={adminView === 'events' ? 'default' : 'outline'}
                  onClick={() => setAdminView('events')}
                >
                  <PartyPopper className="mr-2 h-4 w-4" />
                  {t.nav.events || 'Events'}
                </Button>
              </div>

              {/* Course Selection */}
              {adminView === 'courses' && (
                <div className="space-y-2">
                  <Label>{t.tickets.selectCourse || 'Select Course'}</Label>
                  <Select value={selectedCourse || ''} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.tickets.chooseCourse || 'Choose a course...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title} - {format(new Date(course.starts_at), 'MMM yyyy')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Event Selection */}
              {adminView === 'events' && (
                <div className="space-y-2">
                  <Label>{t.tickets.selectEvent || 'Select Event'}</Label>
                  <Select value={selectedEvent || ''} onValueChange={setSelectedEvent}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.tickets.chooseEvent || 'Choose an event...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map(event => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title} - {format(new Date(event.start_at), 'PPP')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Statistics Display */}
              {(selectedCourse || selectedEvent) && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{attendanceStats.totalAttendees}</div>
                        <p className="text-xs text-muted-foreground">
                          {t.tickets.totalAttendees || 'Total Attendees'}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-blue-600">{attendanceStats.leaders}</div>
                        <p className="text-xs text-muted-foreground">
                          {t.tickets.leaders || 'Leaders'}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-pink-600">{attendanceStats.followers}</div>
                        <p className="text-xs text-muted-foreground">
                          {t.tickets.followers || 'Followers'}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-gray-500">{attendanceStats.notSet}</div>
                        <p className="text-xs text-muted-foreground">
                          {t.tickets.notSet || 'Not Set'}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">{attendanceStats.checkedIn}</div>
                        <p className="text-xs text-muted-foreground">
                          {t.tickets.checkedIn || 'Checked In'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Attendees Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.tickets.name || 'Name'}</TableHead>
                          <TableHead>{t.tickets.email || 'Email'}</TableHead>
                          <TableHead>{t.tickets.phone || 'Phone'}</TableHead>
                          <TableHead>{t.tickets.danceRole || 'Dance Role'}</TableHead>
                          {adminView === 'courses' && (
                            <TableHead>{t.tickets.ticketsRemaining || 'Tickets Remaining'}</TableHead>
                          )}
                          <TableHead>{t.tickets.checkInStatus || 'Check-in Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendees.map(attendee => (
                          <TableRow key={attendee.id}>
                            <TableCell className="font-medium">{attendee.name}</TableCell>
                            <TableCell>{attendee.email}</TableCell>
                            <TableCell>{attendee.phone || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={
                                attendee.danceRole === 'leader' ? 'default' : 
                                attendee.danceRole === 'follower' ? 'secondary' : 
                                'outline'
                              }>
                                {attendee.danceRole === 'leader' ? t.profile.leader : 
                                 attendee.danceRole === 'follower' ? t.profile.follower : 
                                 t.profile.notSet}
                              </Badge>
                            </TableCell>
                            {adminView === 'courses' && (
                              <TableCell>{attendee.ticketsRemaining || 0}</TableCell>
                            )}
                            <TableCell>
                              {attendee.hasCheckedIn ? (
                                <Badge variant="default" className="bg-green-600">
                                  <Check className="mr-1 h-3 w-3" />
                                  {t.tickets.checkedIn || 'Checked In'}
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  {t.tickets.notCheckedIn || 'Not Checked In'}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {attendees.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={adminView === 'courses' ? 6 : 5} className="text-center text-muted-foreground py-8">
                              {t.tickets.noAttendees || 'No attendees found'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member's Personal Tickets Section */}
      {!isAdmin && (
        <div className="space-y-6">
          {/* 1. TICKET BALANCE SUMMARY - TOP */}
          {totalAvailableTickets > 0 && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Tillgängliga Klipp</h3>
                    <p className="text-4xl font-bold text-primary mb-3">{totalAvailableTickets}</p>
                    
                    {validPackages.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Utgår snart:</p>
                        <div className="space-y-1.5">
                          {validPackages
                            .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
                            .slice(0, 3)
                            .map((pkg) => {
                              const remaining = pkg.total_tickets - pkg.tickets_used;
                              const expiryDate = new Date(pkg.expires_at);
                              const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              const isExpiringSoon = daysUntilExpiry <= 30;
                              
                              return (
                                <div key={pkg.id} className="flex items-center gap-2 text-sm">
                                  {isExpiringSoon && <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />}
                                  <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                                    {remaining} klipp utgår {expiryDate.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      variant="default" 
                      className="mt-4 w-full sm:w-auto"
                      onClick={() => navigate('/schema')}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Boka en lektion
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardContent className="p-4 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-semibold text-blue-900 dark:text-blue-100">Så här fungerar det:</p>
                <p className="text-blue-800 dark:text-blue-200">
                  Du kan checka in dig själv genom att klicka på "Checka in nu"-knappen, eller visa din QR-kod för instruktören att skanna.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. BOKADE LEKTIONER SECTION - MIDDLE */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Bokade Lektioner
            </h2>
            
            {validLessonBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                  <div>
                    <p className="font-medium text-muted-foreground">
                      Du har inga bokade lektioner
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gå till schemat för att boka en plats med dina klipp
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/schema')}
                    className="gap-2"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Visa schema
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {validLessonBookings.map((booking) => {
                  const lesson = booking.course_lessons;
                  const lessonDate = new Date(lesson.starts_at);
                  const lessonEndDate = lesson.ends_at ? new Date(lesson.ends_at) : null;
                  const isToday = lessonDate.toDateString() === new Date().toDateString();
                  const canCheckInNow = isToday; // You can add more logic here for check-in window
                  const remaining = booking.checkins_allowed - booking.checkins_used;
                  
                  return (
                    <Card key={booking.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Left: Lesson Info */}
                          <div className="flex-1 space-y-3">
                            <div>
                              <h3 className="font-semibold text-lg">{lesson.title || 'Lektion'}</h3>
                              <Badge variant="secondary" className="mt-1">
                                {remaining} incheckningar kvar
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4 shrink-0" />
                                <span>{formatDate(lesson.starts_at)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4 shrink-0" />
                                <span>
                                  {formatTime(lesson.starts_at)}
                                  {lessonEndDate && ` - ${formatTime(lesson.ends_at!)}`}
                                </span>
                              </div>
                              {lesson.venue && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="h-4 w-4 shrink-0" />
                                  <span>{lesson.venue}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2 pt-2">
                              {canCheckInNow && (
                                <Button
                                  size="sm"
                                  onClick={() => handleLessonCheckIn(booking)}
                                  disabled={checkingIn === booking.id}
                                  className="gap-2"
                                >
                                  <Check className="h-4 w-4" />
                                  {checkingIn === booking.id ? 'Checkar in...' : 'Checka in nu'}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openLessonQRModal(booking)}
                                className="gap-2"
                              >
                                <QrCode className="h-4 w-4" />
                                Visa QR i helskärm
                              </Button>
                            </div>
                          </div>
                          
                          {/* Right: QR Code Preview */}
                          <div className="flex items-center justify-center sm:justify-end">
                            <div className="bg-white p-2 rounded-lg border">
                              {qrCanvasRef.current[booking.qr_payload] ? (
                                <img 
                                  src={qrCanvasRef.current[booking.qr_payload]} 
                                  alt="QR Code"
                                  className="w-24 h-24"
                                />
                              ) : (
                                <div className="w-24 h-24 bg-muted animate-pulse rounded" />
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. EVENT BILJETTER SECTION */}
          {validEventTickets.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PartyPopper className="h-5 w-5" />
                Evenemangsbiljetter
              </h2>
              
              {/* Group tickets by event_id */}
              {(() => {
                const groupedByEvent = validEventTickets.reduce((acc, ticket) => {
                  const eventId = ticket.event_id;
                  if (!acc[eventId]) {
                    acc[eventId] = {
                      event: ticket.events,
                      tickets: []
                    };
                  }
                  acc[eventId].tickets.push(ticket);
                  return acc;
                }, {} as Record<string, { event: typeof validEventTickets[0]['events'], tickets: typeof validEventTickets }>);

                return Object.entries(groupedByEvent).map(([eventId, { event, tickets: eventTickets }]) => (
                  <Card key={eventId} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PartyPopper className="h-5 w-5 text-primary" />
                        {event.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{event.venue}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {eventTickets
                          .sort((a, b) => {
                            // Sort by date first, then by attendee name
                            const dateA = a.event_dates?.start_at || event.start_at;
                            const dateB = b.event_dates?.start_at || event.start_at;
                            const dateCompare = new Date(dateA).getTime() - new Date(dateB).getTime();
                            if (dateCompare !== 0) return dateCompare;
                            
                            const nameA = Array.isArray(a.attendee_names) && a.attendee_names[0] ? String(a.attendee_names[0]) : '';
                            const nameB = Array.isArray(b.attendee_names) && b.attendee_names[0] ? String(b.attendee_names[0]) : '';
                            return nameA.localeCompare(nameB);
                          })
                          .map((ticket) => {
                            // Use event_dates start_at if available, otherwise fall back to event start_at
                            const ticketDate = ticket.event_dates?.start_at || event.start_at;
                            const ticketEndTime = ticket.event_dates?.end_at || event.end_at;
                            const attendeeName = Array.isArray(ticket.attendee_names) && ticket.attendee_names[0] 
                              ? String(ticket.attendee_names[0]) 
                              : 'Person';
                            const statusBadge = getStatusBadge(ticket.status);
                            const hasMultipleDates = eventTickets.some(t => t.event_date_id && t.event_date_id !== eventTickets[0].event_date_id);
                            
                            return (
                              <div 
                                key={ticket.id} 
                                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border"
                              >
                                {/* Ticket Info */}
                                <div className="flex-1 space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{attendeeName}</span>
                                    <Badge variant={statusBadge.variant} className="text-xs">
                                      {statusBadge.label}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      <span>{formatDate(ticketDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>
                                        {formatTime(ticketDate)}
                                        {ticketEndTime && ` - ${formatTime(ticketEndTime)}`}
                                      </span>
                                    </div>
                                  </div>
                                  {hasMultipleDates && ticket.event_date_id && (
                                    <p className="text-xs text-primary font-medium">
                                      Dag {eventTickets.filter(t => t.event_date_id).findIndex(t => 
                                        t.event_dates?.start_at === ticket.event_dates?.start_at
                                      ) + 1} av {new Set(eventTickets.filter(t => t.event_date_id).map(t => t.event_dates?.start_at)).size}
                                    </p>
                                  )}
                                </div>
                                
                                {/* QR Code Preview */}
                                <div className="flex items-center gap-2">
                                  <div className="bg-white p-1.5 rounded border">
                                    {qrCanvasRef.current[ticket.qr_payload] ? (
                                      <img 
                                        src={qrCanvasRef.current[ticket.qr_payload]} 
                                        alt="QR Code"
                                        className="w-16 h-16"
                                      />
                                    ) : (
                                      <div className="w-16 h-16 bg-muted animate-pulse rounded" />
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openQRModal(ticket)}
                                    className="gap-1"
                                  >
                                    <QrCode className="h-4 w-4" />
                                    <span className="hidden sm:inline">Visa QR</span>
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-3">
                        Visa QR-koden vid entrén för att checka in
                      </p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>
          )}

          {/* 4. BILJETTHISTORIK - BOTTOM COLLAPSIBLE */}
          {(historyLessonBookings.length > 0 || historyPackages.length > 0) && (
            <Collapsible className="space-y-2">
              <Card>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                    <span className="text-lg font-semibold">
                      Biljetthistorik ({historyLessonBookings.length + historyPackages.length})
                    </span>
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    <div className="space-y-2">
                      {/* Used Lesson Bookings */}
                      {historyLessonBookings.map((booking) => {
                        const lesson = booking.course_lessons;
                        return (
                          <div key={booking.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                            <Check className="h-4 w-4 text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{lesson.title || 'Lektion'}</p>
                              <p className="text-muted-foreground text-xs">
                                {formatDate(lesson.starts_at)}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0">Använd</Badge>
                          </div>
                        );
                      })}
                      
                      {/* Expired/Used Packages */}
                      {historyPackages.map((pkg) => {
                        const isExpired = new Date(pkg.expires_at) < new Date();
                        const isUsed = pkg.tickets_used >= pkg.total_tickets;
                        return (
                          <div key={pkg.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                            <X className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {pkg.courses?.title || 'Klippkort (Admin Gift)'}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {pkg.total_tickets} klipp - {isExpired ? 'Utgått' : 'Använt'}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {isExpired ? 'Utgått' : 'Använt'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      )}

      {/* QR Code Fullscreen Modal */}
      <Dialog open={!!selectedTicket || !!qrDataUrl} onOpenChange={(open) => {
        if (!open) {
          setSelectedTicket(null);
          setQrDataUrl('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {selectedTicket 
                ? (selectedTicket.type === 'event' 
                    ? selectedTicket.events.title
                    : selectedTicket.courses?.title || 'Biljett')
                : 'QR-kod'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl && (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <img src={qrDataUrl} alt="QR Code" className="w-full max-w-sm" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Visa denna kod för instruktören att skanna
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Standalone Ticket Purchase Dialog */}
      <StandaloneTicketPurchaseDialog 
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
      />

    </div>
  );
}
