import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Edit, Trash2, MoveUp, MoveDown, Calendar, MapPin, Users, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface EventSectionRendererProps {
  section: any;
  event: any;
  editMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function EventSectionRenderer({
  section,
  event,
  editMode,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: EventSectionRendererProps) {
  const [booking, setBooking] = useState(false);

  const handleBooking = async () => {
    try {
      setBooking(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to book this event');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-event-payment', {
        body: { event_id: event.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error('Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  const renderContent = () => {
    switch (section.section_type) {
      case 'hero':
        return (
          <div className="relative h-96 rounded-lg overflow-hidden mb-8">
            {event.image_url && (
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end">
              <div className="p-8 text-white w-full">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">{event.title}</h1>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(event.start_at), 'PPP')}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {event.venue}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {event.capacity - event.sold_count} spots left
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className={`prose prose-lg max-w-none mb-8 text-${section.content.alignment || 'left'}`}>
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <div 
              className={`text-${section.content.fontSize || 'medium'}`}
              dangerouslySetInnerHTML={{ __html: section.content.text || '' }}
            />
          </div>
        );

      case 'video':
        return (
          <div className="mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={section.content.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {section.content.caption && (
              <p className="text-sm text-muted-foreground mt-2 text-center">{section.content.caption}</p>
            )}
          </div>
        );

      case 'image':
        return (
          <div className="mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <div className={`rounded-lg overflow-hidden ${
              section.content.layout === 'full' ? 'w-full' :
              section.content.layout === 'half' ? 'w-1/2 mx-auto' :
              section.content.layout === 'third' ? 'w-1/3 mx-auto' : 'w-full'
            }`}>
              <img
                src={section.content.imageUrl}
                alt={section.content.alt || ''}
                className="w-full h-auto"
              />
            </div>
            {section.content.caption && (
              <p className="text-sm text-muted-foreground mt-2 text-center">{section.content.caption}</p>
            )}
          </div>
        );

      case 'gallery':
        return (
          <div className="mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {section.content.images?.map((img: any, idx: number) => (
                <div key={idx} className="rounded-lg overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.alt || ''}
                    className="w-full h-48 object-cover hover:scale-105 transition-transform cursor-pointer"
                  />
                  {img.caption && (
                    <p className="text-xs text-muted-foreground mt-1">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <Accordion type="single" collapsible className="w-full">
              {section.content.items?.map((item: any, idx: number) => (
                <AccordionItem key={idx} value={`item-${idx}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );

      case 'booking':
        const finalPrice = event.discount_type !== 'none' && event.discount_value
          ? event.discount_type === 'percentage'
            ? event.price_cents * (1 - event.discount_value / 100)
            : event.price_cents - event.discount_value
          : event.price_cents;

        const isSoldOut = event.sold_count >= event.capacity;

        return (
          <Card className="p-6 mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            {section.content.customMessage && (
              <p className="text-muted-foreground mb-4">{section.content.customMessage}</p>
            )}
            
            <div className="space-y-4">
              {section.content.showPrice !== false && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <span className="text-2xl font-bold">
                      {(finalPrice / 100).toFixed(2)} {event.currency}
                    </span>
                    {event.discount_type !== 'none' && event.discount_value && (
                      <Badge variant="secondary" className="ml-2">
                        {event.discount_type === 'percentage' 
                          ? `-${event.discount_value}%`
                          : `-${event.discount_value / 100} ${event.currency}`
                        }
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {section.content.showCapacity !== false && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{event.capacity - event.sold_count} / {event.capacity} spots available</span>
                </div>
              )}

              <Button
                onClick={handleBooking}
                disabled={isSoldOut || booking}
                className="w-full"
                size="lg"
              >
                {booking ? 'Processing...' : isSoldOut ? 'Sold Out' : 'Book Now'}
              </Button>
            </div>
          </Card>
        );

      default:
        return <p className="text-muted-foreground">Unknown section type</p>;
    }
  };

  return (
    <div className="relative group">
      {renderContent()}
      
      {editMode && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveUp && (
            <Button size="icon" variant="secondary" onClick={onMoveUp}>
              <MoveUp className="h-4 w-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button size="icon" variant="secondary" onClick={onMoveDown}>
              <MoveDown className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button size="icon" variant="secondary" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
