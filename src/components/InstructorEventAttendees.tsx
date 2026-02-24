import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Users, Ticket } from 'lucide-react';

export default function InstructorEventAttendees() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      setSelectedEvent(events.find(e => e.id === selectedEventId) || null);
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
              <CalendarDays className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-medium">
                {new Date(selectedEvent.start_at).toLocaleDateString('sv-SE')}
              </p>
              <p className="text-xs text-muted-foreground">Datum</p>
            </div>
          </div>

          <div className="p-4 rounded-lg border">
            <p className="text-sm font-medium">{selectedEvent.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedEvent.venue}</p>
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((selectedEvent.sold_count / selectedEvent.capacity) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedEvent.sold_count} / {selectedEvent.capacity} platser
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Detaljerad deltagarlista för event är tillgänglig via admin.
          </p>
        </div>
      )}
    </div>
  );
}
