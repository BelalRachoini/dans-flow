import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Edit, Trash2, MoveUp, MoveDown, Calendar, MapPin, User, Clock, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useLanguageStore } from '@/store/languageStore';
import { PackageClassSelector } from './PackageClassSelector';

interface CourseSectionRendererProps {
  section: any;
  course: any;
  lessons: any[];
  editMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function CourseSectionRenderer({
  section,
  course,
  lessons,
  editMode,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CourseSectionRendererProps) {
  const { t } = useLanguageStore();
  const [enrolling, setEnrolling] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const handleEnroll = async () => {
    try {
      setEnrolling(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error(t.auth?.pleaseLogin || 'Please log in to enroll');
        return;
      }

      // For package courses, validate class selection
      if (course.is_package) {
        if (selectedClassIds.length === 0) {
          toast.error('Välj minst en klass att delta i');
          return;
        }
        if (selectedClassIds.length > (course.max_selections || 2)) {
          toast.error(`Du kan max välja ${course.max_selections || 2} klasser`);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('create-course-payment', {
        body: { 
          course_id: course.id,
          selected_class_ids: course.is_package ? selectedClassIds : undefined,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Enrollment error:', error);
      toast.error(t.course?.enrollmentError || 'Failed to create enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      beginner: t.course?.beginner || 'Beginner',
      intermediate: t.course?.intermediate || 'Intermediate',
      advanced: t.course?.advanced || 'Advanced',
    };
    return labels[level] || level;
  };

  const renderContent = () => {
    switch (section.section_type) {
      case 'hero':
        return (
          <div className="relative h-96 rounded-lg overflow-hidden mb-8">
            {course.image_url && (
              <img
                src={course.image_url}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end">
              <div className="p-8 text-white w-full">
                <Badge className="mb-2 bg-primary text-primary-foreground">
                  {getLevelLabel(course.level)}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">{course.title}</h1>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {course.profiles?.full_name || t.course?.instructorTBA || 'Instructor TBA'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {lessons.length} {t.course?.lessons || 'lessons'}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {course.venue}
                  </div>
                  {course.starts_at && course.ends_at && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(course.starts_at), 'PPP')} - {format(new Date(course.ends_at), 'PPP')}
                    </div>
                  )}
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
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {section.content.text || ''}
            </div>
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
          </div>
        );

      case 'image':
        return (
          <div className="mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <div className="rounded-lg overflow-hidden">
              <img
                src={section.content.imageUrl}
                alt={section.content.alt || ''}
                className="w-full h-auto"
              />
              {section.content.caption && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {section.content.caption}
                </p>
              )}
            </div>
          </div>
        );

      case 'gallery':
        return (
          <div className="mb-8">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(section.content.images || []).map((img: any, idx: number) => (
                <div key={idx} className="rounded-lg overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.caption || ''}
                    className="w-full h-48 object-cover"
                  />
                  {img.caption && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {img.caption}
                    </p>
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
              {(section.content.items || []).map((item: any, idx: number) => (
                <AccordionItem key={idx} value={`item-${idx}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );

      case 'booking':
        const isPackage = course.is_package;
        const maxSelections = course.max_selections || 2;
        const canEnroll = !isPackage || (selectedClassIds.length > 0 && selectedClassIds.length <= maxSelections);

        return (
          <Card className="mb-8 p-6">
            {section.title && <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>}
            
            <div className="space-y-6">
              {/* Package class selection */}
              {isPackage && (
                <PackageClassSelector
                  courseId={course.id}
                  maxSelections={maxSelections}
                  selectedClassIds={selectedClassIds}
                  onSelectionChange={setSelectedClassIds}
                />
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-primary">
                    {(course.price_cents / 100).toFixed(0)} kr
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPackage 
                      ? `Välj ${maxSelections} klasser`
                      : `${t.course?.includesTickets || 'Includes'} ${lessons.length} ${t.course?.tickets || 'tickets'}`
                    }
                  </p>
                </div>
                <Button 
                  onClick={handleEnroll} 
                  disabled={enrolling || !canEnroll}
                  size="lg"
                  className="gap-2"
                >
                  <Ticket className="h-4 w-4" />
                  {enrolling ? (t.common?.loading || 'Loading...') : (t.course?.enrollNow || 'Enroll Now')}
                </Button>
              </div>

              {/* Non-package: show lesson schedule */}
              {!isPackage && lessons.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t.course?.lessonSchedule || 'Lesson Schedule'}</h3>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="schedule">
                      <AccordionTrigger>
                        {t.course?.viewSchedule || 'View all lessons'} ({lessons.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {lessons.map((lesson, idx) => (
                            <div key={lesson.id} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">{idx + 1}</Badge>
                              <span>{format(new Date(lesson.starts_at), 'PPP')}</span>
                              <span className="text-muted-foreground">
                                {format(new Date(lesson.starts_at), 'HH:mm')} - {format(new Date(lesson.ends_at), 'HH:mm')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {isPackage 
                      ? 'Välj dina klasser ovan - du får biljetter för alla lektioner i valda klasser'
                      : (t.course?.flexibleTicketInfo || 'Flexible ticket system - use tickets for any lesson')
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {t.course?.ticketExpiry || 'Tickets expire'}: {course.ends_at ? format(new Date(course.ends_at), 'PPP') : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative group">
      {renderContent()}
      
      {editMode && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onMoveUp && (
            <Button size="sm" variant="secondary" onClick={onMoveUp}>
              <MoveUp className="h-4 w-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button size="sm" variant="secondary" onClick={onMoveDown}>
              <MoveDown className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
