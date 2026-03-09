import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Users, Ticket, CheckCircle } from 'lucide-react';

export default function InstructorEventAttendees() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      setSelectedEvent(events.find(e => e.id === selectedEventId) || null);
      fetchAttendees(selectedEventId);
    }
  }, [selectedEventId, events]);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_at, venue, capacity, sold_count, status')
      .eq('status', 'published')
      .order('start_at', { ascending: false });

    setEvents(data || []);
  };

  const fetchAttendees = async (eventId: string) => {
    setLoading(true);
    setAttendees([]);
    try {
      const { data: bookings } = await supabase
        .from('event_bookings')
        .select(`
          id, ticket_count, status, checkins_used, checkins_allowed,
          profiles:member_id (id, full_name, email, phone)
        `)
        .eq('event_id', eventId)
        .in('status', ['confirmed', 'checked_in']);

      if (!bookings) {
        setAttendees([]);
        return;
      }

      // Get event checkins for this event
      const { data: checkins } = await supabase
        .from('event_checkins')
        .select('booking_id')
        .eq('event_id', eventId);

      const checkedInBookingIds = new Set((checkins || []).map(c => c.booking_id));

      const enriched = bookings.map(b => ({
        ...b,
        hasCheckedIn: checkedInBookingIds.has(b.id),
      }));

      setAttendees(enriched);
    } catch (err) {
      console.error('Error fetching event attendees:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: attendees.reduce((sum, a) => sum + (a.ticket_count || 1), 0),
    bookings: attendees.length,
    checkedIn: attendees.filter(a => a.hasCheckedIn).length,
  };

  return (
    <div className="space-y-4">
      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
        <SelectTrigger>
          <SelectValue placeholder="Välj ett event..." />
        </SelectTrigger>
        <SelectContent>
          {events.map(e => (
            <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedEvent && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border text-center">
              <Ticket className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{selectedEvent.sold_count}</p>
              <p className="text-xs text-muted-foreground">Sålda</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{selectedEvent.capacity}</p>
              <p className="text-xs text-muted-foreground">Kapacitet</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
              <p className="text-xs text-muted-foreground">Incheckade</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <CalendarDays className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">
                {new Date(selectedEvent.start_at).toLocaleDateString('sv-SE')}
              </p>
              <p className="text-xs text-muted-foreground">Datum</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="p-4 rounded-lg border">
            <p className="text-sm font-medium">{selectedEvent.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedEvent.venue}</p>
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${selectedEvent.capacity > 0 ? Math.min((selectedEvent.sold_count / selectedEvent.capacity) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedEvent.sold_count} / {selectedEvent.capacity} platser
              </p>
            </div>
          </div>

          {/* Attendee table */}
          {loading ? (
            <div className="h-20 bg-muted animate-pulse rounded" />
          ) : attendees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Biljetter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Incheckning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.map((a: any) => {
                  const profile = a.profiles as any;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {profile?.full_name || 'Okänd'}
                      </TableCell>
                      <TableCell>{a.ticket_count}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'checked_in' ? 'default' : 'outline'}>
                          {a.status === 'checked_in' ? 'Incheckad' : 'Bekräftad'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.hasCheckedIn ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga bokningar för detta event
            </p>
          )}
        </div>
      )}
    </div>
  );
}
