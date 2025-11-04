import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Lesson {
  id?: string;
  title?: string;
  starts_at: Date;
  ends_at?: Date;
  venue?: string;
  notes?: string;
}

interface CourseLessonsProps {
  courseId?: string;
}

export function CourseLessons({ courseId }: CourseLessonsProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (courseId) {
      loadLessons();
    }
  }, [courseId]);

  const loadLessons = async () => {
    if (!courseId) return;
    
    try {
      const { data, error } = await supabase
        .from('course_lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('starts_at', { ascending: true });

      if (error) throw error;

      setLessons(data.map(l => ({
        ...l,
        starts_at: new Date(l.starts_at),
        ends_at: l.ends_at ? new Date(l.ends_at) : undefined,
      })));
    } catch (error) {
      console.error('Error loading lessons:', error);
    }
  };

  const addLesson = () => {
    setLessons([...lessons, {
      starts_at: new Date(),
      ends_at: undefined,
      title: '',
      venue: '',
      notes: '',
    }]);
  };

  const removeLesson = async (index: number) => {
    const lesson = lessons[index];
    
    if (lesson.id && courseId) {
      try {
        const { error } = await supabase
          .from('course_lessons')
          .delete()
          .eq('id', lesson.id);

        if (error) throw error;
        toast.success('Lektion borttagen');
      } catch (error) {
        console.error('Error deleting lesson:', error);
        toast.error('Kunde inte ta bort lektion');
        return;
      }
    }

    setLessons(lessons.filter((_, i) => i !== index));
  };

  const updateLesson = (index: number, field: keyof Lesson, value: any) => {
    const updated = [...lessons];
    updated[index] = { ...updated[index], [field]: value };
    setLessons(updated);
  };

  const saveLessons = async () => {
    if (!courseId) {
      toast.error('Spara kursen först');
      return;
    }

    setLoading(true);
    try {
      // Delete existing lessons and insert new ones
      const { error: deleteError } = await supabase
        .from('course_lessons')
        .delete()
        .eq('course_id', courseId);

      if (deleteError) throw deleteError;

      // Insert all lessons
      const lessonsToInsert = lessons.map(lesson => ({
        course_id: courseId,
        title: lesson.title || null,
        starts_at: lesson.starts_at.toISOString(),
        ends_at: lesson.ends_at?.toISOString() || null,
        venue: lesson.venue || null,
        notes: lesson.notes || null,
      }));

      if (lessonsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('course_lessons')
          .insert(lessonsToInsert);

        if (insertError) throw insertError;
      }

      toast.success('Lektioner sparade');
      loadLessons();
    } catch (error) {
      console.error('Error saving lessons:', error);
      toast.error('Kunde inte spara lektioner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Lektioner ({lessons.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLesson}>
          <Plus className="h-4 w-4 mr-2" />
          Lägg till lektion
        </Button>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {lessons.map((lesson, index) => (
          <Card key={index} className="p-4">
            <CardContent className="p-0 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-sm">Lektionstitel (valfritt)</Label>
                    <Input
                      value={lesson.title || ''}
                      onChange={(e) => updateLesson(index, 'title', e.target.value)}
                      placeholder="T.ex. Lektion 1: Grundsteg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Starttid</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal text-sm",
                              !lesson.starts_at && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {lesson.starts_at ? format(lesson.starts_at, "dd/MM HH:mm") : <span>Välj</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={lesson.starts_at}
                            onSelect={(date) => {
                              if (date) {
                                const current = lesson.starts_at;
                                date.setHours(current.getHours(), current.getMinutes());
                                updateLesson(index, 'starts_at', date);
                              }
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                          <div className="p-3 border-t">
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                placeholder="HH"
                                value={lesson.starts_at?.getHours() ?? ''}
                                onChange={(e) => {
                                  const date = new Date(lesson.starts_at);
                                  date.setHours(parseInt(e.target.value) || 0);
                                  updateLesson(index, 'starts_at', date);
                                }}
                                className="w-16"
                              />
                              <span>:</span>
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="MM"
                                value={lesson.starts_at?.getMinutes() ?? ''}
                                onChange={(e) => {
                                  const date = new Date(lesson.starts_at);
                                  date.setMinutes(parseInt(e.target.value) || 0);
                                  updateLesson(index, 'starts_at', date);
                                }}
                                className="w-16"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label className="text-sm">Sluttid (valfritt)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal text-sm",
                              !lesson.ends_at && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {lesson.ends_at ? format(lesson.ends_at, "dd/MM HH:mm") : <span>Välj</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={lesson.ends_at}
                            onSelect={(date) => {
                              if (date) {
                                const current = lesson.ends_at || lesson.starts_at;
                                date.setHours(current.getHours(), current.getMinutes());
                                updateLesson(index, 'ends_at', date);
                              }
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                          <div className="p-3 border-t">
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                placeholder="HH"
                                value={lesson.ends_at?.getHours() ?? ''}
                                onChange={(e) => {
                                  const date = lesson.ends_at || new Date(lesson.starts_at);
                                  date.setHours(parseInt(e.target.value) || 0);
                                  updateLesson(index, 'ends_at', date);
                                }}
                                className="w-16"
                              />
                              <span>:</span>
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="MM"
                                value={lesson.ends_at?.getMinutes() ?? ''}
                                onChange={(e) => {
                                  const date = lesson.ends_at || new Date(lesson.starts_at);
                                  date.setMinutes(parseInt(e.target.value) || 0);
                                  updateLesson(index, 'ends_at', date);
                                }}
                                className="w-16"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm">Plats (valfritt)</Label>
                    <Input
                      value={lesson.venue || ''}
                      onChange={(e) => updateLesson(index, 'venue', e.target.value)}
                      placeholder="T.ex. Studio A"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLesson(index)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {courseId && lessons.length > 0 && (
        <Button 
          type="button" 
          onClick={saveLessons} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Sparar...' : 'Spara lektioner'}
        </Button>
      )}

      {!courseId && lessons.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Spara kursen först för att lägga till lektioner
        </p>
      )}
    </div>
  );
}