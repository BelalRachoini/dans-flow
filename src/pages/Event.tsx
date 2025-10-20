import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, MapPin, Clock, Plus, Edit, Trash2, Ticket, Image as ImageIcon } from 'lucide-react';
import { listEvents, createEvent, updateEvent, deleteEvent, listTicketTypes } from '@/services/mockApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Event, TicketType } from '@/types';
import { useNavigate } from 'react-router-dom';

const eventSchema = z.object({
  title: z.string().min(1, 'Titel krävs').max(100),
  description: z.string().optional(),
  date: z.string().min(1, 'Datum krävs'),
  time: z.string().min(1, 'Tid krävs'),
  location: z.string().min(1, 'Plats krävs'),
  mediaUrl: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

export default function Event() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [ticketTypesByEvent, setTicketTypesByEvent] = useState<Record<string, TicketType[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const eventsData = await listEvents();
      setEvents(eventsData);
      
      // Load ticket types for each event
      const ticketTypesMap: Record<string, TicketType[]> = {};
      for (const event of eventsData) {
        const types = await listTicketTypes(event.id);
        ticketTypesMap[event.id] = types;
      }
      setTicketTypesByEvent(ticketTypesMap);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitEvent = async (data: EventFormData) => {
    try {
      if (editingEvent) {
        const updated = await updateEvent(editingEvent.id, data as Partial<Event>);
        setEvents(events.map(e => e.id === updated.id ? updated : e));
        toast.success('Eventet har uppdaterats!');
      } else {
        const newEvent = await createEvent(data as Omit<Event, 'id'>);
        setEvents([newEvent, ...events]);
        toast.success('Eventet har skapats!');
      }
      setDialogOpen(false);
      setEditingEvent(null);
      reset();
    } catch (error) {
      toast.error('Något gick fel');
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setValue('title', event.title);
    setValue('description', event.description || '');
    setValue('date', event.date);
    setValue('time', event.time);
    setValue('location', event.location);
    setValue('mediaUrl', event.mediaUrl || '');
    setDialogOpen(true);
  };

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteEvent(eventToDelete.id);
      setEvents(events.filter(e => e.id !== eventToDelete.id));
      toast.success('Eventet har tagits bort!');
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    } catch (error) {
      toast.error('Något gick fel');
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    reset();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) {
      return { label: 'Avslutat', variant: 'secondary' as const };
    } else if (eventDate.toDateString() === today.toDateString()) {
      return { label: 'Idag', variant: 'default' as const };
    } else {
      return { label: 'Kommande', variant: 'default' as const };
    }
  };

  if (loading) {
    return <div className="text-center py-12">{sv.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{sv.events.title}</h1>
          <p className="mt-1 text-muted-foreground">
            Upptäck kommande dansevent och köp biljetter
          </p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="mr-2" size={16} />
                {sv.events.createEvent}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? sv.events.editEvent : sv.events.createEvent}
                </DialogTitle>
                <DialogDescription>
                  {editingEvent ? 'Uppdatera eventinformation' : 'Skapa ett nytt dansevent'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmitEvent)} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titel</Label>
                  <Input id="title" {...register('title')} placeholder="T.ex. Salsa Night Party" />
                  {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                </div>

                <div>
                  <Label htmlFor="description">Beskrivning</Label>
                  <Textarea 
                    id="description" 
                    {...register('description')} 
                    placeholder="Beskriv eventet..."
                    rows={4}
                  />
                  {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Datum</Label>
                    <Input id="date" type="date" {...register('date')} />
                    {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="time">Tid</Label>
                    <Input id="time" type="time" {...register('time')} />
                    {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Plats</Label>
                  <Input id="location" {...register('location')} placeholder="T.ex. Danspalatset Stockholm" />
                  {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
                </div>

                <div>
                  <Label htmlFor="mediaUrl">Bild URL (valfritt)</Label>
                  <Input id="mediaUrl" {...register('mediaUrl')} placeholder="https://..." />
                  {errors.mediaUrl && <p className="text-sm text-destructive mt-1">{errors.mediaUrl.message}</p>}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    {sv.common.cancel}
                  </Button>
                  <Button type="submit" variant="hero">
                    {editingEvent ? 'Uppdatera' : sv.common.create}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Events Grid */}
      {events.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const status = getEventStatus(event.date);
            const ticketTypes = ticketTypesByEvent[event.id] || [];
            const hasTickets = ticketTypes.length > 0;

            return (
              <Card key={event.id} className="shadow-md transition-smooth hover:shadow-lg flex flex-col overflow-hidden">
                {event.mediaUrl && (
                  <div className="relative h-48 bg-muted">
                    <img 
                      src={event.mediaUrl} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {!event.mediaUrl && (
                  <div className="relative h-48 gradient-primary flex items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-white/30" />
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {event.description && (
                    <CardDescription className="mt-2 line-clamp-2">
                      {event.description}
                    </CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(event.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>
                  
                  {hasTickets && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Ticket className="h-4 w-4" />
                        <span>Biljetter tillgängliga</span>
                      </div>
                      <div className="space-y-1">
                        {ticketTypes.map(type => (
                          <div key={type.id} className="flex justify-between text-sm">
                            <span>{type.name}</span>
                            <span className="font-semibold">{type.priceSEK} kr</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="flex gap-2">
                  {hasTickets && (
                    <Button 
                      variant="hero" 
                      className="flex-1"
                      onClick={() => navigate('/biljetter', { state: { eventId: event.id } })}
                    >
                      <Ticket size={16} className="mr-2" />
                      Köp biljett
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleEdit(event)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDeleteClick(event)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-md">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Inga event ännu</h3>
            <p className="text-muted-foreground mb-4">
              {isAdmin ? 'Skapa ditt första event för att komma igång' : 'Kom tillbaka senare för kommande event'}
            </p>
            {isAdmin && (
              <Button variant="hero" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2" size={16} />
                {sv.events.createEvent}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kommer permanent ta bort eventet "{eventToDelete?.title}". Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
