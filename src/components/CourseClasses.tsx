import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Plus, Trash2, Info, Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { sv as svLocale } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/languageStore';

interface CourseClass {
  id?: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string;
  lesson_count?: number;
}

interface CourseClassesProps {
  courseId?: string;
  courseStartDate?: Date;
  courseEndDate?: Date;
}


const dayLabels: Record<number, string> = {
  0: 'Söndag',
  1: 'Måndag',
  2: 'Tisdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lördag',
};

export function CourseClasses({ courseId, courseStartDate, courseEndDate }: CourseClassesProps) {
  const { t } = useLanguageStore();
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [newClass, setNewClass] = useState<CourseClass>({
    name: '',
    day_of_week: 1,
    start_time: '18:00',
    end_time: '20:00',
    venue: '',
  });

  useEffect(() => {
    if (courseId) {
      loadClasses();
    }
  }, [courseId]);

  const loadClasses = async () => {
    if (!courseId) return;
    
    try {
      const { data, error } = await supabase
        .from('course_classes')
        .select('*')
        .eq('course_id', courseId)
        .order('day_of_week', { ascending: true });

      if (error) throw error;

      // Get lesson counts for each class
      const classesWithCounts = await Promise.all((data || []).map(async (cls: any) => {
        const { count } = await supabase
          .from('course_lessons')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id);
        
        return {
          ...cls,
          lesson_count: count || 0,
        };
      }));

      setClasses(classesWithCounts);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const calculateRecurringLessons = (
    startDate: Date,
    endDate: Date,
    dayOfWeek: number
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

  const addClass = async () => {
    if (!courseId) {
      toast.error('Spara kursen först');
      return;
    }

    if (!newClass.name.trim()) {
      toast.error('Ange ett namn för klassen');
      return;
    }

    if (!courseStartDate || !courseEndDate) {
      toast.error('Kursen måste ha start- och slutdatum');
      return;
    }

    setLoading(true);
    try {
      // Create the class
      const { data: classData, error: classError } = await supabase
        .from('course_classes')
        .insert({
          course_id: courseId,
          name: newClass.name,
          day_of_week: newClass.day_of_week,
          start_time: newClass.start_time,
          end_time: newClass.end_time,
          venue: newClass.venue || null,
        })
        .select()
        .single();

      if (classError) throw classError;

      // Generate recurring lessons for this class
      const dates = calculateRecurringLessons(
        courseStartDate,
        courseEndDate,
        newClass.day_of_week
      );

      const lessonsToInsert = dates.map((date, index) => {
        const [startHour, startMinute] = newClass.start_time.split(':');
        const [endHour, endMinute] = newClass.end_time.split(':');
        
        const startsAt = new Date(date);
        startsAt.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
        
        const endsAt = new Date(date);
        endsAt.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
        
        return {
          course_id: courseId,
          class_id: classData.id,
          title: `${newClass.name} - ${index + 1}`,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          venue: newClass.venue || null,
        };
      });

      if (lessonsToInsert.length > 0) {
        const { error: lessonsError } = await supabase
          .from('course_lessons')
          .insert(lessonsToInsert);

        if (lessonsError) throw lessonsError;
      }

      toast.success(`Klass skapad med ${lessonsToInsert.length} lektioner`);
      
      setNewClass({
        name: '',
        day_of_week: 1,
        start_time: '18:00',
        end_time: '20:00',
        venue: '',
      });
      
      loadClasses();
    } catch (error) {
      console.error('Error adding class:', error);
      toast.error('Kunde inte skapa klass');
    } finally {
      setLoading(false);
    }
  };

  const deleteClass = async (classId: string) => {
    if (!confirm('Vill du ta bort denna klass och alla dess lektioner?')) return;

    try {
      // Delete lessons first (cascade should handle this, but being explicit)
      await supabase
        .from('course_lessons')
        .delete()
        .eq('class_id', classId);

      // Delete the class
      const { error } = await supabase
        .from('course_classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;

      toast.success('Klass borttagen');
      loadClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Kunde inte ta bort klass');
    }
  };

  const getPreviewCount = () => {
    if (!courseStartDate || !courseEndDate) return 0;
    return calculateRecurringLessons(courseStartDate, courseEndDate, newClass.day_of_week).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Klasser i paketet</h3>
        {classes.length > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            {classes.length}
          </span>
        )}
      </div>

      {/* Add new class form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Klassnamn</Label>
            <Input
              value={newClass.name}
              onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
              placeholder="t.ex. Bachata Måndag"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Veckodag</Label>
              <Select 
                value={newClass.day_of_week.toString()} 
                onValueChange={(v) => setNewClass({ ...newClass, day_of_week: parseInt(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Måndag</SelectItem>
                  <SelectItem value="2">Tisdag</SelectItem>
                  <SelectItem value="3">Onsdag</SelectItem>
                  <SelectItem value="4">Torsdag</SelectItem>
                  <SelectItem value="5">Fredag</SelectItem>
                  <SelectItem value="6">Lördag</SelectItem>
                  <SelectItem value="0">Söndag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plats</Label>
              <Input
                value={newClass.venue}
                onChange={(e) => setNewClass({ ...newClass, venue: e.target.value })}
                placeholder="Dans Vida Studio"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Starttid</Label>
              <Input
                type="time"
                value={newClass.start_time}
                onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Sluttid</Label>
              <Input
                type="time"
                value={newClass.end_time}
                onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })}
              />
            </div>
          </div>

          {courseStartDate && courseEndDate && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">
                {getPreviewCount()} lektioner kommer skapas
              </AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                Varje {dayLabels[newClass.day_of_week]} från kursstart till kursslut
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={addClass} disabled={loading} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Lägg till klass
          </Button>
        </CardContent>
      </Card>

      {/* Existing classes */}
      <div className="space-y-3">
        {classes.map((cls) => (
          <Card key={cls.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">{cls.name}</h4>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {dayLabels[cls.day_of_week]}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {cls.start_time} - {cls.end_time}
                    </div>
                    {cls.venue && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {cls.venue}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-primary font-medium">
                    {cls.lesson_count} lektioner
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => cls.id && deleteClass(cls.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {classes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Inga klasser ännu. Lägg till klasser ovan.
        </div>
      )}
    </div>
  );
}
