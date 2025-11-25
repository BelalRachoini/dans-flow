import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarIcon, Plus, Trash2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { sv as svLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/languageStore';

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
  courseStartDate?: Date;
  courseEndDate?: Date;
}

const timeOptions = Array.from({ length: 13 }, (_, i) => {
  const hour = 17 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

export function CourseLessons({ courseId, courseStartDate, courseEndDate }: CourseLessonsProps) {
  const { t } = useLanguageStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'recurring'>('manual');
  const lessonsListRef = useRef<HTMLDivElement>(null);
  
  const [recurringForm, setRecurringForm] = useState({
    dayOfWeek: 1,
    startTime: '18:00',
    endTime: '20:00',
    venue: '',
    titleTemplate: 'Lektion {n}',
    notes: '',
  });

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
    const now = new Date();
    now.setHours(18, 0, 0, 0);
    const endTime = new Date(now);
    endTime.setHours(20, 0, 0, 0);
    
    setLessons([...lessons, {
      starts_at: now,
      ends_at: endTime,
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

  const calculateRecurringLessons = (
    startDate: Date,
    endDate: Date,
    dayOfWeek: number,
    startTime: string,
    endTime: string
  ): Date[] => {
    const lessonDates: Date[] = [];
    const current = new Date(startDate);
    
    while (current.getDay() !== dayOfWeek && current <= endDate) {
      current.setDate(current.getDate() + 1);
    }
    
    while (current <= endDate) {
      lessonDates.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }
    
    return lessonDates;
  };

  const validateRecurringForm = (): string | null => {
    if (!courseStartDate || !courseEndDate) {
      return t.courses.lessons?.needCourseDates || 'Kursen måste ha start- och slutdatum';
    }
    
    if (recurringForm.endTime <= recurringForm.startTime) {
      return t.courses.lessons?.endTimeAfterStart || 'Sluttid måste vara efter starttid';
    }
    
    const previewDates = calculateRecurringLessons(
      courseStartDate,
      courseEndDate,
      recurringForm.dayOfWeek,
      recurringForm.startTime,
      recurringForm.endTime
    );
    
    if (previewDates.length === 0) {
      return 'Den valda veckodagen förekommer inte i kursperioden';
    }
    
    return null;
  };

  const generateRecurringLessons = () => {
    if (!courseStartDate || !courseEndDate) {
      toast.error(t.courses.lessons?.needCourseDates || 'Kursen måste ha start- och slutdatum');
      return;
    }
    
    const error = validateRecurringForm();
    if (error) {
      toast.error(error);
      return;
    }
    
    const dates = calculateRecurringLessons(
      courseStartDate,
      courseEndDate,
      recurringForm.dayOfWeek,
      recurringForm.startTime,
      recurringForm.endTime
    );
    
    const newLessons = dates.map((date, index) => {
      const [startHour, startMinute] = recurringForm.startTime.split(':');
      const [endHour, endMinute] = recurringForm.endTime.split(':');
      
      const startsAt = new Date(date);
      startsAt.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      
      const endsAt = new Date(date);
      endsAt.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
      
      return {
        title: recurringForm.titleTemplate.replace('{n}', (lessons.length + index + 1).toString()),
        starts_at: startsAt,
        ends_at: endsAt,
        venue: recurringForm.venue,
        notes: recurringForm.notes,
      };
    });
    
    setLessons([...lessons, ...newLessons]);
    toast.success((t.courses.lessons?.lessonsGenerated || '{count} lektioner genererade').replace('{count}', newLessons.length.toString()));
    
    // Switch to manual tab to show generated lessons
    setMode('manual');
    
    // Scroll to lessons list
    setTimeout(() => {
      lessonsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    setRecurringForm({
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '20:00',
      venue: '',
      titleTemplate: 'Lektion {n}',
      notes: '',
    });
  };

  const saveLessons = async () => {
    if (!courseId) {
      toast.error('Spara kursen först');
      return;
    }

    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('course_lessons')
        .delete()
        .eq('course_id', courseId);

      if (deleteError) throw deleteError;

    const lessonsToInsert = lessons.map(lesson => {
      // Ensure ends_at is never null - default to 2 hours after start
      const endsAt = lesson.ends_at || new Date(lesson.starts_at.getTime() + 2 * 60 * 60 * 1000);
      return {
        course_id: courseId,
        title: lesson.title || null,
        starts_at: lesson.starts_at.toISOString(),
        ends_at: endsAt.toISOString(),
        venue: lesson.venue || null,
        notes: lesson.notes || null,
      };
    });

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

  const RecurringPreview = () => {
    if (!courseStartDate || !courseEndDate) return null;
    
    const previewDates = calculateRecurringLessons(
      courseStartDate,
      courseEndDate,
      recurringForm.dayOfWeek,
      recurringForm.startTime,
      recurringForm.endTime
    );
    
    if (previewDates.length === 0) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Inga lektioner kommer skapas med dessa inställningar
          </AlertDescription>
        </Alert>
      );
    }
    
    return (
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          {(t.courses.lessons?.lessonsWillBeCreated || 'Detta kommer skapa {count} lektioner').replace('{count}', previewDates.length.toString())}
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
          <div className="mt-2 space-y-1">
            {previewDates.slice(0, 3).map((date, i) => (
              <div key={i}>
                {format(date, 'EEEE d MMMM yyyy', { locale: svLocale })} 
                {' kl. '}{recurringForm.startTime}-{recurringForm.endTime}
              </div>
            ))}
            {previewDates.length > 3 && (
              <div className="text-muted-foreground">
                ... och {previewDates.length - 3} fler
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Lektioner</h3>
        {lessons.length > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            {lessons.length}
          </span>
        )}
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'recurring')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">{t.courses.lessons?.manual || 'Manuell'}</TabsTrigger>
          <TabsTrigger value="recurring">{t.courses.lessons?.recurring || 'Återkommande'}</TabsTrigger>
        </TabsList>

        <TabsContent value="recurring" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.courses.lessons?.dayOfWeek || 'Veckodag'}</Label>
                  <Select value={recurringForm.dayOfWeek.toString()} onValueChange={(v) => setRecurringForm({ ...recurringForm, dayOfWeek: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t.courses.monday || 'Måndag'}</SelectItem>
                      <SelectItem value="2">{t.courses.tuesday || 'Tisdag'}</SelectItem>
                      <SelectItem value="3">{t.courses.wednesday || 'Onsdag'}</SelectItem>
                      <SelectItem value="4">{t.courses.thursday || 'Torsdag'}</SelectItem>
                      <SelectItem value="5">{t.courses.friday || 'Fredag'}</SelectItem>
                      <SelectItem value="6">{t.courses.saturday || 'Lördag'}</SelectItem>
                      <SelectItem value="0">{t.courses.sunday || 'Söndag'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.courses.lessons?.startTime || 'Starttid'}</Label>
                  <Select value={recurringForm.startTime} onValueChange={(v) => setRecurringForm({ ...recurringForm, startTime: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.courses.lessons?.endTime || 'Sluttid'}</Label>
                  <Select value={recurringForm.endTime} onValueChange={(v) => setRecurringForm({ ...recurringForm, endTime: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plats</Label>
                  <Input value={recurringForm.venue} onChange={(e) => setRecurringForm({ ...recurringForm, venue: e.target.value })} placeholder="Dans Vida Studio" />
                </div>
              </div>
              <div>
                <Label>Titel (använd {'{n}'} för nummer)</Label>
                <Input value={recurringForm.titleTemplate} onChange={(e) => setRecurringForm({ ...recurringForm, titleTemplate: e.target.value })} placeholder="Lektion {n}" />
              </div>
              <div>
                <Label>Anteckningar</Label>
                <Textarea value={recurringForm.notes} onChange={(e) => setRecurringForm({ ...recurringForm, notes: e.target.value })} placeholder="Valfria anteckningar..." />
              </div>
              <RecurringPreview />
              <Button onClick={generateRecurringLessons} className="w-full">{t.courses.lessons?.generateLessons || 'Generera Lektioner'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Button onClick={addLesson} variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Lägg till lektion</Button>
        </TabsContent>
      </Tabs>

      <div ref={lessonsListRef} className="space-y-3 max-h-[500px] overflow-y-auto">
        {lessons.map((lesson, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  #{index + 1}
                </div>
                <div className="flex-1 space-y-3">
                  <Input 
                    value={lesson.title || ''} 
                    onChange={(e) => updateLesson(index, 'title', e.target.value)} 
                    placeholder="Lektion titel"
                    className="font-medium"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Datum</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-sm h-9">
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {lesson.starts_at ? format(lesson.starts_at, "d MMM yyyy", { locale: svLocale }) : "Välj"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar 
                            mode="single" 
                            selected={lesson.starts_at} 
                            onSelect={(date) => { 
                              if (date) { 
                                const newDate = new Date(date); 
                                if (lesson.starts_at) newDate.setHours(lesson.starts_at.getHours(), lesson.starts_at.getMinutes()); 
                                updateLesson(index, 'starts_at', newDate); 
                                if (lesson.ends_at) { 
                                  const newEnd = new Date(date); 
                                  newEnd.setHours(lesson.ends_at.getHours(), lesson.ends_at.getMinutes()); 
                                  updateLesson(index, 'ends_at', newEnd); 
                                }
                              }
                            }} 
                            className={cn("p-3 pointer-events-auto")} 
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Starttid</Label>
                      <Select 
                        value={lesson.starts_at ? format(lesson.starts_at, 'HH:mm') : '18:00'} 
                        onValueChange={(time) => { 
                          const [h, m] = time.split(':'); 
                          const date = new Date(lesson.starts_at || new Date()); 
                          date.setHours(parseInt(h), parseInt(m)); 
                          updateLesson(index, 'starts_at', date); 
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Sluttid</Label>
                      <Select 
                        value={lesson.ends_at ? format(lesson.ends_at, 'HH:mm') : '20:00'} 
                        onValueChange={(time) => { 
                          const [h, m] = time.split(':'); 
                          const date = new Date(lesson.starts_at || new Date()); 
                          date.setHours(parseInt(h), parseInt(m)); 
                          updateLesson(index, 'ends_at', date); 
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Plats</Label>
                    <Input 
                      value={lesson.venue || ''} 
                      onChange={(e) => updateLesson(index, 'venue', e.target.value)} 
                      placeholder="Dans Vida Studio"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Anteckningar</Label>
                    <Textarea 
                      value={lesson.notes || ''} 
                      onChange={(e) => updateLesson(index, 'notes', e.target.value)} 
                      placeholder="Valfria anteckningar..." 
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeLesson(index)} 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {courseId && lessons.length > 0 && <Button onClick={saveLessons} disabled={loading} className="w-full">{loading ? 'Sparar...' : 'Spara lektioner'}</Button>}
      {!courseId && lessons.length > 0 && <p className="text-sm text-muted-foreground text-center">Spara kursen först för att kunna spara lektionerna</p>}
    </div>
  );
}
