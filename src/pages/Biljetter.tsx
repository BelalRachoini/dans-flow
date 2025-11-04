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
  PartyPopper, ShoppingCart, Search, X, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import QRCodeLib from 'qrcode';
import { sv } from '@/locales/sv';

interface TicketWithCourse {
  id: string;
  member_id: string;
  course_id: string;
  purchased_at: string;
  status: string;
  qr_payload: string;
  max_checkins: number;
  checked_in_count: number;
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
  const [tickets, setTickets] = useState<AllTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<AllTickets | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCanvasRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    loadTickets();
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
          courses (
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
    return <div className="text-center py-12">{sv.common.loading}</div>;
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

  // Empty state when user has no tickets
  if (tickets.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{sv.nav.biljetter}</h1>
          <p className="mt-1 text-muted-foreground">
            Dina eventbiljetter
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

  // Tickets list view (for when user has tickets)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{sv.nav.biljetter}</h1>
          <p className="mt-1 text-muted-foreground">
            Dina kursbiljetter och incheckningar
          </p>
        </div>
        <Button variant="hero" onClick={() => navigate('/kurser-poang')}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Köp kurser
        </Button>
      </div>

      {/* Info Box */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Så här fungerar det:</p>
            <p className="text-muted-foreground">
              Visa din QR-kod för instruktören när du kommer till kursen. 
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
                      <div className="text-muted-foreground">Incheckningar</div>
                      <div className="font-semibold">
                        {ticket.checked_in_count} / {ticket.max_checkins}
                      </div>
                    </div>
                  </div>
                )}

                {(ticket.status === 'valid' || ticket.status === 'confirmed') && (
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => openQRModal(ticket)}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Visa QR i helskärm
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
