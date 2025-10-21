import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Ticket, Calendar, MapPin, Clock, QrCode, 
  PartyPopper, ShoppingCart
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { sv } from '@/locales/sv';
import type { Ticket as TicketType, Event } from '@/types';

export default function Biljetter() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [events, setEvents] = useState<Record<string, Event>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        // TODO: Load user's tickets from API
        // For now, we'll use an empty array
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [user?.id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return <div className="text-center py-12">{sv.common.loading}</div>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{sv.nav.biljetter}</h1>
          <p className="mt-1 text-muted-foreground">
            Dina eventbiljetter
          </p>
        </div>
        <Button variant="hero" onClick={() => navigate('/event')}>
          <PartyPopper className="mr-2 h-4 w-4" />
          Se fler event
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tickets.map((ticket) => {
          const event = events[ticket.eventId];
          if (!event) return null;

          return (
            <Card key={ticket.id} className="shadow-md overflow-hidden">
              <div className="gradient-primary p-4 text-white">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">{event.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-white/90">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(event.date)}</span>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={ticket.used ? 'bg-white/20' : 'bg-white text-primary'}
                  >
                    {ticket.used ? 'Använd' : 'Aktiv'}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Biljettkod</div>
                    <div className="font-mono text-sm font-semibold">{ticket.qrCode}</div>
                  </div>
                </div>

                {!ticket.used && (
                  <Button className="w-full" variant="outline">
                    <QrCode className="mr-2 h-4 w-4" />
                    Visa QR-kod
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
