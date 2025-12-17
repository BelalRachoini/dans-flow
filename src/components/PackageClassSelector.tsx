import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';

interface CourseClass {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  lesson_count?: number;
}

interface PackageClassSelectorProps {
  courseId: string;
  maxSelections: number;
  selectedClassIds: string[];
  onSelectionChange: (classIds: string[]) => void;
}

const dayLabels: Record<number, string> = {
  0: 'Sön',
  1: 'Mån',
  2: 'Tis',
  3: 'Ons',
  4: 'Tor',
  5: 'Fre',
  6: 'Lör',
};

const dayLabelsFull: Record<number, string> = {
  0: 'Söndag',
  1: 'Måndag',
  2: 'Tisdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lördag',
};

export function PackageClassSelector({
  courseId,
  maxSelections,
  selectedClassIds,
  onSelectionChange,
}: PackageClassSelectorProps) {
  const { t } = useLanguageStore();
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    loadClasses();
  }, [courseId]);

  const loadClasses = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClass = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      // Remove
      onSelectionChange(selectedClassIds.filter(id => id !== classId));
    } else {
      // Add (if not at max)
      if (selectedClassIds.length < maxSelections) {
        onSelectionChange([...selectedClassIds, classId]);
      }
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const clearFilter = () => setSelectedDays([]);

  const isMaxReached = selectedClassIds.length >= maxSelections;
  
  // Filter classes by selected days
  const filteredClasses = selectedDays.length === 0
    ? classes
    : classes.filter(cls => selectedDays.includes(cls.day_of_week));

  const totalLessons = classes
    .filter(cls => selectedClassIds.includes(cls.id))
    .reduce((sum, cls) => sum + (cls.lesson_count || 0), 0);

  // Get unique days that have classes
  const availableDays = [...new Set(classes.map(cls => cls.day_of_week))].sort();

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Laddar klasser...</div>;
  }

  if (classes.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Inga klasser tillgängliga i detta paket.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day Filter */}
      {availableDays.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Filtrera efter dag:</span>
            {selectedDays.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilter}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Rensa
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableDays.map(day => (
              <Button
                key={day}
                variant={selectedDays.includes(day) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDay(day)}
                className="h-8 px-3 text-xs"
              >
                {dayLabels[day]}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Välj dina klasser
        </h3>
        <Badge variant={isMaxReached ? 'default' : 'outline'}>
          {selectedClassIds.length}/{maxSelections} valda
        </Badge>
      </div>

      {isMaxReached && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du har valt maximalt antal klasser ({maxSelections}). Avmarkera en klass för att välja en annan.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            Inga klasser på de valda dagarna
          </div>
        ) : filteredClasses.map((cls) => {
          const isSelected = selectedClassIds.includes(cls.id);
          const isDisabled = !isSelected && isMaxReached;
          
          return (
            <Card
              key={cls.id}
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                  : isDisabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:border-primary/50'
              }`}
              onClick={() => !isDisabled && handleToggleClass(cls.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => handleToggleClass(cls.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold">{cls.name}</h4>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {dayLabels[cls.day_of_week]}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {cls.start_time} - {cls.end_time}
                      </div>
                      {cls.venue && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {cls.venue}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-primary font-medium">
                      {cls.lesson_count} lektioner inkluderade
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedClassIds.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Totalt antal lektioner:</span>
            <span className="font-semibold">{totalLessons}</span>
          </div>
        </div>
      )}
    </div>
  );
}
