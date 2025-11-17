import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { EventSectionRenderer } from '@/components/EventSectionRenderer';
import { EventSectionEditor } from '@/components/EventSectionEditor';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  venue: string;
  image_url: string | null;
  price_cents: number;
  capacity: number;
  sold_count: number;
  status: string;
  currency: string;
  discount_type: string;
  discount_value: number | null;
}

interface EventSection {
  id: string;
  event_id: string;
  section_type: string;
  title: string | null;
  content: any;
  position: number;
  is_visible: boolean;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [event, setEvent] = useState<Event | null>(null);
  const [sections, setSections] = useState<EventSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState<EventSection | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchEventData();
  }, [id]);

  const fetchEventData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('event_page_sections')
        .select('*')
        .eq('event_id', id)
        .eq('is_visible', true)
        .order('position', { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
    } catch (error: any) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async (section: Partial<EventSection>) => {
    try {
      if (section.id) {
        // Update existing section
        const { error } = await supabase
          .from('event_page_sections')
          .update({
            title: section.title,
            content: section.content,
            section_type: section.section_type,
          })
          .eq('id', section.id);

        if (error) throw error;
        toast.success('Section updated');
      } else {
        // Create new section
        const maxPosition = sections.length > 0 
          ? Math.max(...sections.map(s => s.position))
          : -1;

        const { error } = await supabase
          .from('event_page_sections')
          .insert({
            event_id: id!,
            section_type: section.section_type!,
            title: section.title,
            content: section.content,
            position: maxPosition + 1,
          });

        if (error) throw error;
        toast.success('Section added');
      }

      await fetchEventData();
      setEditingSection(null);
      setShowAddSection(false);
    } catch (error: any) {
      console.error('Error saving section:', error);
      toast.error('Failed to save section');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('event_page_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;
      toast.success('Section deleted');
      await fetchEventData();
    } catch (error: any) {
      console.error('Error deleting section:', error);
      toast.error('Failed to delete section');
    }
  };

  const handleReorderSection = async (sectionId: string, newPosition: number) => {
    try {
      const { error } = await supabase
        .from('event_page_sections')
        .update({ position: newPosition })
        .eq('id', sectionId);

      if (error) throw error;
      await fetchEventData();
    } catch (error: any) {
      console.error('Error reordering section:', error);
      toast.error('Failed to reorder section');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/event')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant={editMode ? "default" : "outline"}
                onClick={() => setEditMode(!editMode)}
              >
                <Edit className="mr-2 h-4 w-4" />
                {editMode ? 'Exit Edit Mode' : 'Edit Page'}
              </Button>
              {editMode && (
                <Button onClick={() => setShowAddSection(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {sections.map((section, index) => (
          <EventSectionRenderer
            key={section.id}
            section={section}
            event={event}
            editMode={editMode && isAdmin}
            onEdit={() => setEditingSection(section)}
            onDelete={() => handleDeleteSection(section.id)}
            onMoveUp={
              index > 0
                ? () => handleReorderSection(section.id, section.position - 1)
                : undefined
            }
            onMoveDown={
              index < sections.length - 1
                ? () => handleReorderSection(section.id, section.position + 1)
                : undefined
            }
          />
        ))}

        {sections.length === 0 && !isAdmin && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No content available for this event yet.</p>
          </div>
        )}

        {sections.length === 0 && isAdmin && !editMode && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">This event has no sections yet.</p>
            <Button onClick={() => setEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Start Editing
            </Button>
          </div>
        )}
      </div>

      {/* Section Editor Dialog */}
      <EventSectionEditor
        section={editingSection}
        event={event}
        open={!!editingSection || showAddSection}
        onClose={() => {
          setEditingSection(null);
          setShowAddSection(false);
        }}
        onSave={handleSaveSection}
      />
    </div>
  );
}
