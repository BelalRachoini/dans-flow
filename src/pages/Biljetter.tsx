import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Ticket, Calendar, MapPin, Clock, QrCode, 
  PartyPopper, ShoppingCart, Search, X, Info, Check,
  Users, GraduationCap
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

interface TicketWithCourse {
  id: string;
  member_id: string;
  course_id: string | null;
  source_course_id: string;
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
  };
}

interface EventTicket {
  id: string;
  member_id: string;
  event_id: string;
  booked_at: string;
  status: string;
  qr_payload: string;
  payment_status: string;
  events: {
    id: string;
    title: string;
    start_at: string;
    end_at: string | null;
    venue: string;
    description: string;
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

      // Load event tickets
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
          )
        `)
        .eq('member_id', user.id)
        .order('booked_at', { ascending: false });

      if (eventError) throw eventError;

      // Combine and type tickets
      const allTickets: AllTickets[] = [
        ...(courseTickets || []).map(t => ({ ...t, type: 'course' as const })),
        ...(eventTickets || []).map(t => ({ ...t, type: 'event' as const }))
      ];

      setTickets(allTickets);

      // Pre-generate QR codes for all tickets
      for (const ticket of allTickets) {
        generateQRCode(ticket.qr_payload);
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
    if (ticket.type === 'event') {
      return ticket.status === 'confirmed' && ticket.payment_status === 'paid';
    } else {
      return ticket.status === 'valid' && ticket.tickets_used < ticket.total_tickets;
    }
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
      ? ticket.courses.title 
      : ticket.events.title;
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

  // Empty state when user has no tickets (only for non-admins)
  if (tickets.length === 0 && !isAdmin) {
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
        <Button variant="hero" onClick={() => navigate('/kurser-poang')}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          {t.tickets.buyCourses}
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

      {/* Member's Personal Tickets Section - Only show for non-admins or when admin has tickets */}
      {(!isAdmin || tickets.length > 0) && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Ticket className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-muted-foreground font-medium">
                    Du har inga personliga biljetter
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Köp en kurs eller evenemangsbiljett för att komma igång
                  </p>
                </div>
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" onClick={() => navigate('/kurser-poang')}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Köp kurser
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/event')}>
                    <PartyPopper className="mr-2 h-4 w-4" />
                    Se event
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Info Box */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">Så här fungerar det:</p>
                    <p className="text-muted-foreground">
                      Du kan checka in dig själv genom att klicka på "Checka in nu"-knappen, eller visa din QR-kod för instruktören att skanna. 
                      Klicka på "Visa QR i helskärm" för en större kod som är lättare att skanna.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Sök kurs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla</SelectItem>
                    <SelectItem value="valid">Giltiga</SelectItem>
                    <SelectItem value="checked_in">Incheckade</SelectItem>
                    <SelectItem value="cancelled">Avbrutna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tickets Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredTickets.map((ticket) => {
          const statusBadge = getStatusBadge(ticket.status);
          const isCourseTicket = ticket.type === 'course';
          const title = isCourseTicket ? ticket.courses.title : ticket.events.title;
          const startDate = isCourseTicket ? ticket.courses.starts_at : ticket.events.start_at;
          const venue = isCourseTicket ? ticket.courses.venue : ticket.events.venue;
          
          return (
            <Card key={ticket.id} className="shadow-md overflow-hidden">
              <div className="gradient-primary p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-xl font-bold truncate">{title}</h3>
                    <div className="flex items-center gap-2 text-sm text-white/90">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="truncate">{formatDate(startDate)}</span>
                    </div>
                    {!isCourseTicket && (
                      <Badge variant="secondary" className="text-xs">
                        Event
                      </Badge>
                    )}
                  </div>
                  <Badge 
                    variant={statusBadge.variant}
                    className="shrink-0"
                  >
                    {statusBadge.label}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{formatTime(startDate)}</span>
                  </div>
                  {venue && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{venue}</span>
                    </div>
                  )}
                </div>

                {/* QR Code Preview */}
                {(ticket.status === 'valid' || ticket.status === 'confirmed') && qrCanvasRef.current[ticket.qr_payload] && (
                  <div className="pt-4 border-t">
                    <div className="bg-white p-3 rounded-lg border inline-block mx-auto block w-full text-center">
                      <img 
                        src={qrCanvasRef.current[ticket.qr_payload]} 
                        alt="QR Code"
                        className="w-32 h-32 mx-auto"
                      />
                    </div>
                  </div>
                )}

                {isCourseTicket && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">Klipp använda</div>
                      <div className="font-semibold">
                        {ticket.tickets_used} / {ticket.total_tickets}
                      </div>
                    </div>
                  </div>
                )}

                {(ticket.status === 'valid' || ticket.status === 'confirmed') && (
                  <div className="space-y-2">
                    {canCheckIn(ticket) && (
                      <Button 
                        className="w-full" 
                        variant="default"
                        onClick={() => handleSelfCheckIn(ticket)}
                        disabled={checkingIn === ticket.id}
                      >
                        {checkingIn === ticket.id ? (
                          <>Checkar in...</>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Checka in nu
                          </>
                        )}
                      </Button>
                    )}
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => openQRModal(ticket)}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Visa QR i helskärm
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
            </div>
          </>
        )}
        </div>
      )}

      {filteredTickets.length === 0 && tickets.length > 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            Inga biljetter matchar dina filter
          </p>
        </Card>
      )}

      {/* QR Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>QR-kod för incheckning</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedTicket(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-bold text-lg mb-2">
                  {selectedTicket.type === 'course' 
                    ? selectedTicket.courses.title 
                    : selectedTicket.events.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTicket.type === 'course'
                    ? `${formatDate(selectedTicket.courses.starts_at)} • ${formatTime(selectedTicket.courses.starts_at)}`
                    : `${formatDate(selectedTicket.events.start_at)} • ${formatTime(selectedTicket.events.start_at)}`}
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg border">
                {qrDataUrl && (
                  <img 
                    src={qrDataUrl} 
                    alt="QR Code"
                    className="w-full h-auto"
                  />
                )}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Visa denna kod för instruktören
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
