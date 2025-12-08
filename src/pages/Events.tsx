import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, MapPin, Clock, Plus, Edit, Trash2, Ticket, Image as ImageIcon, Users, Copy, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { EventTicketPurchaseDialog } from '@/components/EventTicketPurchaseDialog';

type EventData = Tables<'events'>;
type EventBooking = Tables<'event_bookings'> & {
  profiles: Tables<'profiles'>;
};

const eventSchema = z.object({
  title: z.string().min(4, 'Title must be at least 4 characters').max(120, 'Title must be less than 120 characters'),
  image_url: z.string().url('Must be a valid URL').startsWith('http', 'Must start with http or https').max(1000).optional().or(z.literal('')),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000, 'Description must be less than 2000 characters'),
  venue: z.string().min(2, 'Venue must be at least 2 characters').max(120, 'Venue must be less than 120 characters'),
  price: z.number().min(1, 'Price must be at least 1 kr'),
  couple_price: z.number().min(0).optional(),
  trio_price: z.number().min(0).optional(),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  discount_enabled: z.boolean().default(false),
  discount_type: z.enum(['none', 'percent', 'amount']).default('none'),
  discount_value: z.number().min(0).default(0),
});

interface EventDate {
  id?: string;
  date: string;
  time: string;
}

type EventFormData = z.infer<typeof eventSchema>;

export default function EventsPage() {
  const { role, userId } = useAuthStore();
  const { t, language } = useLanguageStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventData | null>(null);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [attendeesDialogOpen, setAttendeesDialogOpen] = useState(false);
  const [selectedEventAttendees, setSelectedEventAttendees] = useState<EventBooking[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [eventDates, setEventDates] = useState<EventDate[]>([{ date: '', time: '' }]);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [selectedEventForPurchase, setSelectedEventForPurchase] = useState<EventData | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      discount_enabled: false,
      discount_type: 'none',
      discount_value: 0,
    }
  });

  const isAdmin = role === 'admin';
  const watchPrice = watch('price');
  const watchDiscountType = watch('discount_type');
  const watchDiscountValue = watch('discount_value');

  useEffect(() => {
    loadEvents();
  }, []);

  // Handle payment success redirect
  useEffect(() => {
    const payment = searchParams.get('payment');
    const eventId = searchParams.get('event_id');
    const sessionId = searchParams.get('session_id');

    if (payment === 'success' && eventId && sessionId && !processingPayment) {
      completeBooking(eventId, sessionId);
    } else if (payment === 'cancelled') {
      toast.error('Betalningen avbröts');
      // Clean up URL
      searchParams.delete('payment');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDisplayPrice = (event: EventData) => {
    const priceSEK = event.price_cents / 100;
    if (event.discount_type === 'none') {
      return { current: priceSEK, original: null, discountPercent: null };
    }

    let priceAfter = priceSEK;
    if (event.discount_type === 'percent') {
      priceAfter = priceSEK * (1 - event.discount_value / 100);
    } else if (event.discount_type === 'amount') {
      priceAfter = priceSEK - (event.discount_value / 100);
    }

    priceAfter = Math.max(priceAfter, 0.01);
    const discountPercent = event.discount_type === 'percent' 
      ? event.discount_value 
      : Math.round((1 - priceAfter / priceSEK) * 100);

    return { current: priceAfter, original: priceSEK, discountPercent };
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat(language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  const formatTime = (dateStr: string) => {
    return new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  const getEventStatus = (event: EventData) => {
    const eventDate = new Date(event.start_at);
    const now = new Date();
    
    if (eventDate < now) {
      return { label: t.events.ended, variant: 'secondary' as const };
    }
    if (event.sold_count >= event.capacity) {
      return { label: t.events.soldOut, variant: 'destructive' as const };
    }
    return { label: t.events.upcoming, variant: 'default' as const };
  };

  const onSubmitEvent = async (data: EventFormData) => {
    if (!userId) return;

    try {
      const price_cents = Math.round(data.price * 100);
      
      let discount_type = 'none';
      let discount_value = 0;

      if (data.discount_enabled && data.discount_type !== 'none') {
        discount_type = data.discount_type;
        discount_value = data.discount_value;

        // Validate discount
        if (discount_type === 'percent' && (discount_value < 1 || discount_value > 90)) {
          toast.error('Discount percent must be between 1 and 90');
          return;
        }
        if (discount_type === 'amount') {
          const discount_cents = Math.round(discount_value * 100);
          if (discount_cents >= price_cents) {
            toast.error('Discount amount must be less than price');
            return;
          }
          discount_value = discount_cents;
        }
      }

      // Validate event dates
      const validDates = eventDates.filter(d => d.date && d.time);
      if (validDates.length === 0) {
        toast.error('Please add at least one event date');
        return;
      }

      // Use first date as primary start_at for backward compatibility
      const primaryDateTime = new Date(`${validDates[0].date}T${validDates[0].time}`);
      
      // Validate all datetimes are in future
      for (const dateItem of validDates) {
        const dateTime = new Date(`${dateItem.date}T${dateItem.time}`);
        if (dateTime < new Date()) {
          toast.error('All event dates must be in the future');
          return;
        }
      }

      // Calculate couple and trio prices in cents
      const couple_price_cents = data.couple_price && data.couple_price > 0 
        ? Math.round(data.couple_price * 100) 
        : null;
      const trio_price_cents = data.trio_price && data.trio_price > 0 
        ? Math.round(data.trio_price * 100) 
        : null;

      const eventData = {
        title: data.title,
        image_url: data.image_url || null,
        description: data.description,
        venue: data.venue,
        start_at: primaryDateTime.toISOString(),
        price_cents,
        couple_price_cents,
        trio_price_cents,
        capacity: data.capacity,
        discount_type,
        discount_value,
        created_by: userId,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id);

        if (error) throw error;

        // Delete existing event dates and insert new ones
        await supabase
          .from('event_dates')
          .delete()
          .eq('event_id', editingEvent.id);

        const datesToInsert = validDates.map(d => ({
          event_id: editingEvent.id,
          start_at: new Date(`${d.date}T${d.time}`).toISOString(),
        }));

        const { error: datesError } = await supabase
          .from('event_dates')
          .insert(datesToInsert);

        if (datesError) throw datesError;

        toast.success(t.events.saved);
      } else {
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) throw error;

        // Insert event dates
        const datesToInsert = validDates.map(d => ({
          event_id: newEvent.id,
          start_at: new Date(`${d.date}T${d.time}`).toISOString(),
        }));

        const { error: datesError } = await supabase
          .from('event_dates')
          .insert(datesToInsert);

        if (datesError) throw datesError;

        toast.success(t.events.saved);
      }

      setDrawerOpen(false);
      setEditingEvent(null);
      reset();
      setDiscountEnabled(false);
      setEventDates([{ date: '', time: '' }]);
      loadEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast.error(error.message || t.common.error);
    }
  };

  const handleEdit = async (event: EventData) => {
    setEditingEvent(event);

    setValue('title', event.title);
    setValue('description', event.description);
    setValue('venue', event.venue);
    setValue('image_url', event.image_url || '');
    setValue('price', event.price_cents / 100);
    setValue('couple_price', event.couple_price_cents ? event.couple_price_cents / 100 : undefined);
    setValue('trio_price', event.trio_price_cents ? event.trio_price_cents / 100 : undefined);
    setValue('capacity', event.capacity);
    
    const hasDiscount = event.discount_type !== 'none';
    setDiscountEnabled(hasDiscount);
    setValue('discount_enabled', hasDiscount);
    setValue('discount_type', event.discount_type as any);
    setValue('discount_value', event.discount_type === 'amount' ? event.discount_value / 100 : event.discount_value);

    // Load event dates
    const { data: dates } = await supabase
      .from('event_dates')
      .select('*')
      .eq('event_id', event.id)
      .order('start_at');

    if (dates && dates.length > 0) {
      const loadedDates = dates.map(d => {
        const dateObj = new Date(d.start_at);
        return {
          id: d.id,
          date: dateObj.toISOString().split('T')[0],
          time: dateObj.toTimeString().slice(0, 5),
        };
      });
      setEventDates(loadedDates);
    } else {
      // Fallback to main start_at if no event_dates found
      const startDate = new Date(event.start_at);
      setEventDates([{
        date: startDate.toISOString().split('T')[0],
        time: startDate.toTimeString().slice(0, 5),
      }]);
    }
    
    setDrawerOpen(true);
  };

  const handleDeleteClick = (event: EventData) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete.id);

      if (error) throw error;
      
      toast.success(t.events.deleted);
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      loadEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || t.common.error);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setEditingEvent(null);
      reset();
      setDiscountEnabled(false);
      setEventDates([{ date: '', time: '' }]);
    }
  };

  const addEventDate = () => {
    setEventDates([...eventDates, { date: '', time: '' }]);
  };

  const removeEventDate = (index: number) => {
    if (eventDates.length > 1) {
      setEventDates(eventDates.filter((_, i) => i !== index));
    }
  };

  const updateEventDate = (index: number, field: 'date' | 'time', value: string) => {
    const updated = [...eventDates];
    updated[index][field] = value;
    setEventDates(updated);
  };

  const handleDuplicate = async (event: EventData) => {
    try {
      toast.loading(t.common.duplicating, { id: 'duplicate-event' });

      // Set start date to tomorrow at the same time
      const originalDate = new Date(event.start_at);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

      // Create duplicate event with modified title and reset fields
      const eventData = {
        title: `${event.title} (Kopia)`,
        image_url: event.image_url,
        description: event.description,
        venue: event.venue,
        start_at: tomorrow.toISOString(),
        end_at: event.end_at ? new Date(new Date(event.end_at).getTime() + (24 * 60 * 60 * 1000)).toISOString() : null,
        price_cents: event.price_cents,
        capacity: event.capacity,
        discount_type: event.discount_type,
        discount_value: event.discount_value,
        status: 'draft', // Set to draft so admin can review before publishing
        sold_count: 0, // Reset sold count
        created_by: userId!,
      };

      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (eventError) throw eventError;
      if (!newEvent) throw new Error('Failed to create event');

      const newEventId = newEvent.id;

      // Duplicate event page sections
      const { data: sections, error: sectionsError } = await supabase
        .from('event_page_sections' as any)
        .select('*')
        .eq('event_id', event.id);

      if (sectionsError) throw sectionsError;

      if (sections && sections.length > 0) {
        const sectionsToInsert = sections.map((section: any) => ({
          event_id: newEventId,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          position: section.position,
          is_visible: section.is_visible
        }));

        const { error: insertSectionsError } = await supabase
          .from('event_page_sections' as any)
          .insert(sectionsToInsert);

        if (insertSectionsError) throw insertSectionsError;
      }

      toast.success(t.common.duplicated, { id: 'duplicate-event' });
      loadEvents();
      
      // Navigate to the new event detail page
      navigate(`/event/${newEventId}`);
    } catch (error) {
      console.error('Error duplicating event:', error);
      toast.error(t.common.error, { id: 'duplicate-event' });
    }
  };

  const handleViewAttendees = async (eventId: string) => {
    setLoadingAttendees(true);
    setAttendeesDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('event_bookings')
        .select(`
          *,
          profiles:member_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'confirmed')
        .order('booked_at', { ascending: false });

      if (error) throw error;
      setSelectedEventAttendees(data as any || []);
    } catch (error: any) {
      console.error('Error loading attendees:', error);
      toast.error(error.message || t.common.error);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  const completeBooking = async (eventId: string, sessionId: string) => {
    if (processingPayment) return;
    
    setProcessingPayment(true);
    try {
      console.log('Completing booking for event:', eventId, 'session:', sessionId);

      // Verify user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        console.error('Profile check failed:', profileError);
        toast.error('Kunde inte verifiera din profil. Försök logga in igen.');
        return;
      }

      // Check if booking already exists
      const { data: existingBooking } = await supabase
        .from('event_bookings')
        .select('id')
        .eq('event_id', eventId)
        .eq('member_id', userId!)
        .maybeSingle();

      if (existingBooking) {
        toast.success('Biljett redan registrerad! Du hittar den under "Biljetter".');
        // Clean up URL
        searchParams.delete('payment');
        searchParams.delete('event_id');
        searchParams.delete('session_id');
        setSearchParams(searchParams);
        loadEvents();
        return;
      }

      // Create booking
      const { data, error } = await supabase
        .from('event_bookings')
        .insert({
          event_id: eventId,
          member_id: userId!,
          status: 'confirmed',
          payment_status: 'paid',
        })
        .select();

      if (error) {
        console.error('Booking creation error:', error);
        throw error;
      }

      console.log('Booking created:', data);

      // Update sold count
      const event = events.find(e => e.id === eventId);
      if (event) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ sold_count: event.sold_count + 1 })
          .eq('id', eventId);

        if (updateError) {
          console.error('Update sold count error:', updateError);
        }
      }

      toast.success('Betalning genomförd! Din biljett finns under "Biljetter".');
      
      // Clean up URL
      searchParams.delete('payment');
      searchParams.delete('event_id');
      searchParams.delete('session_id');
      setSearchParams(searchParams);
      
      loadEvents();
    } catch (error: any) {
      console.error('Error completing booking:', error);
      toast.error(error.message || 'Kunde inte slutföra bokningen.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleBuyTicket = (event: EventData) => {
    if (!userId) {
      toast.error('Du måste vara inloggad för att köpa biljetter');
      return;
    }

    if (event.sold_count >= event.capacity) {
      toast.error('Eventet är fullbokat');
      return;
    }

    setSelectedEventForPurchase(event);
    setTicketDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-12">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t.events.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {t.events.upcoming} {t.events.title.toLowerCase()}
          </p>
        </div>
        {isAdmin && (
          <Drawer open={drawerOpen} onOpenChange={handleDrawerClose}>
            <DrawerTrigger asChild>
              <Button variant="hero">
                <Plus className="mr-2" size={16} />
                {t.events.createEvent}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
              <div className="overflow-y-auto max-w-2xl mx-auto w-full p-6">
                <DrawerHeader>
                  <DrawerTitle>
                    {editingEvent ? t.events.editEvent : t.events.createEvent}
                  </DrawerTitle>
                  <DrawerDescription>
                    {editingEvent ? 'Update event information' : 'Create a new dance event'}
                  </DrawerDescription>
                </DrawerHeader>
                <form onSubmit={handleSubmit(onSubmitEvent)} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="title">{t.events.eventTitle}</Label>
                    <Input id="title" {...register('title')} placeholder="E.g. Salsa Night Party" />
                    {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="image_url">{t.events.imageUrl}</Label>
                    <Input id="image_url" {...register('image_url')} placeholder="https://..." />
                    {errors.image_url && <p className="text-sm text-destructive mt-1">{errors.image_url.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="description">{t.events.description}</Label>
                    <Textarea 
                      id="description" 
                      {...register('description')} 
                      placeholder="Describe the event..."
                      rows={4}
                    />
                    {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Event Dates</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addEventDate}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Date
                      </Button>
                    </div>
                    
                    {eventDates.map((eventDate, index) => (
                      <div key={index} className="flex gap-2 items-start border rounded-lg p-3">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Date {index + 1}</Label>
                            <Input 
                              type="date" 
                              value={eventDate.date}
                              onChange={(e) => updateEventDate(index, 'date', e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Time</Label>
                            <Input 
                              type="time" 
                              value={eventDate.time}
                              onChange={(e) => updateEventDate(index, 'time', e.target.value)}
                              className="h-9"
                            />
                          </div>
                        </div>
                        {eventDates.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-5 h-9 w-9"
                            onClick={() => removeEventDate(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Add multiple dates if the event occurs on different days. Each date can have its own time.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="venue">{t.events.venue}</Label>
                    <Input id="venue" {...register('venue')} placeholder="E.g. Danspalatset Stockholm" />
                    {errors.venue && <p className="text-sm text-destructive mt-1">{errors.venue.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">{t.events.price} (kr)</Label>
                      <Input 
                        id="price" 
                        type="number" 
                        {...register('price', { valueAsNumber: true })} 
                        placeholder="299"
                      />
                      {errors.price && <p className="text-sm text-destructive mt-1">{errors.price.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="capacity">{t.events.capacity}</Label>
                      <Input 
                        id="capacity" 
                        type="number" 
                        {...register('capacity', { valueAsNumber: true })} 
                        placeholder="100"
                      />
                      {errors.capacity && <p className="text-sm text-destructive mt-1">{errors.capacity.message}</p>}
                    </div>
                  </div>

                  {/* Group Ticket Pricing */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-base font-semibold">{t.eventTickets?.couplePrice ? 'Group Ticket Pricing' : 'Group Ticket Pricing'}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t.eventTickets?.couplePriceHelp || 'Optional: Set custom prices for group tickets. Leave empty to use multiples of the single price.'}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="couple_price">{t.eventTickets?.couplePrice || 'Couple Price (2 tickets)'} (kr)</Label>
                        <Input 
                          id="couple_price" 
                          type="number" 
                          {...register('couple_price', { valueAsNumber: true })} 
                          placeholder={watchPrice ? String(watchPrice * 2) : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="trio_price">{t.eventTickets?.trioPrice || 'Price for 3 tickets'} (kr)</Label>
                        <Input 
                          id="trio_price" 
                          type="number" 
                          {...register('trio_price', { valueAsNumber: true })} 
                          placeholder={watchPrice ? String(watchPrice * 3) : ''}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="discount-toggle">{t.events.discount.add}</Label>
                      <Switch 
                        id="discount-toggle"
                        checked={discountEnabled}
                        onCheckedChange={(checked) => {
                          setDiscountEnabled(checked);
                          setValue('discount_enabled', checked);
                          if (!checked) {
                            setValue('discount_type', 'none');
                            setValue('discount_value', 0);
                          }
                        }}
                      />
                    </div>

                    {discountEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{t.events.discount.type}</Label>
                          <Select
                            value={watchDiscountType}
                            onValueChange={(value) => setValue('discount_type', value as any)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">{t.events.discount.percent}</SelectItem>
                              <SelectItem value="amount">{t.events.discount.amount}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>{t.events.discount.value}</Label>
                          <Input 
                            type="number" 
                            {...register('discount_value', { valueAsNumber: true })}
                            placeholder={watchDiscountType === 'percent' ? '20' : '50'}
                            max={watchDiscountType === 'percent' ? 90 : watchPrice - 1}
                            min={1}
                          />
                        </div>
                      </div>
                    )}

                    {discountEnabled && watchPrice && watchDiscountValue > 0 && (
                      <div className="text-sm bg-muted p-3 rounded-md">
                        <p className="font-medium mb-1">Price preview:</p>
                        <p className="text-muted-foreground line-through">{formatPrice(watchPrice)}</p>
                        <p className="text-lg font-bold text-primary">
                          {formatPrice(
                            watchDiscountType === 'percent' 
                              ? watchPrice * (1 - watchDiscountValue / 100)
                              : watchPrice - watchDiscountValue
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <DrawerFooter className="px-0">
                    <Button type="submit" variant="hero">
                      {t.common.save}
                    </Button>
                    <DrawerClose asChild>
                      <Button type="button" variant="outline">
                        {t.common.cancel}
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </form>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {/* Events Grid */}
      {events.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const status = getEventStatus(event);
            const priceInfo = calculateDisplayPrice(event);
            const availableSeats = event.capacity - event.sold_count;

            return (
              <Card 
                key={event.id} 
                className="shadow-md transition-smooth hover:shadow-lg flex flex-col overflow-hidden cursor-pointer"
                onClick={() => navigate(`/event/${event.id}`)}
              >
                {event.image_url ? (
                  <div className="relative h-48 bg-muted aspect-video">
                    <img 
                      src={event.image_url} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative h-48 gradient-primary flex items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-white/30" />
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <CardDescription className="mt-2 line-clamp-2">
                    {event.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(event.start_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatTime(event.start_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.venue}</span>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        {priceInfo.original ? (
                          <div>
                            <span className="text-sm text-muted-foreground line-through">
                              {formatPrice(priceInfo.original)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-primary">
                                {formatPrice(priceInfo.current)}
                              </span>
                              <Badge variant="destructive" className="text-xs">
                                -{priceInfo.discountPercent}%
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xl font-bold">
                            {formatPrice(priceInfo.current)}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {availableSeats > 0 ? (
                            <span className="text-green-600">{t.events.ticketsAvailable}</span>
                          ) : (
                            <span className="text-destructive">{t.events.soldOut}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {availableSeats}/{event.capacity} {t.events.capacity.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="flex gap-2">
                  {isAdmin ? (
                    <>
                      <Button 
                        variant="secondary" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAttendees(event.id);
                        }}
                      >
                        <Users size={16} className="mr-2" />
                        {t.events.viewAttendees}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(event);
                        }}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(event);
                        }}
                      >
                        <Copy size={16} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(event);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  ) : (
                    availableSeats > 0 && (
                      <Button 
                        variant="hero" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyTicket(event);
                        }}
                      >
                        <Ticket size={16} className="mr-2" />
                        {t.events.buyTicket}
                      </Button>
                    )
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
            <h3 className="text-lg font-semibold mb-2">{t.events.noEvents}</h3>
            <p className="text-muted-foreground mb-4">
              {isAdmin ? 'Create your first event to get started' : 'Come back later for upcoming events'}
            </p>
            {isAdmin && (
              <Button variant="hero" onClick={() => setDrawerOpen(true)}>
                <Plus className="mr-2" size={16} />
                {t.events.createEvent}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.events.deleteEvent}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the event "{eventToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendees Dialog */}
      <Dialog open={attendeesDialogOpen} onOpenChange={setAttendeesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t.events.attendeesList}
            </DialogTitle>
            <DialogDescription>
              {selectedEventAttendees.length} {t.events.attendees.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          
          {loadingAttendees ? (
            <div className="text-center py-8">{t.common.loading}</div>
          ) : selectedEventAttendees.length > 0 ? (
            <div className="space-y-3">
              {selectedEventAttendees.map((booking) => (
                <Card key={booking.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {booking.profiles?.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{booking.profiles?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.events.bookedAt}: {formatDateTime(booking.booked_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={booking.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {booking.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t.events.noAttendees}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Purchase Dialog */}
      {selectedEventForPurchase && (
        <EventTicketPurchaseDialog
          open={ticketDialogOpen}
          onOpenChange={setTicketDialogOpen}
          event={selectedEventForPurchase}
        />
      )}
    </div>
  );
}