import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Calendar, MapPin, User, Clock, Coins, ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { sv as svLocale } from 'date-fns/locale';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select(`
            *,
            profiles:primary_instructor(full_name)
          `)
          .eq('id', id)
          .single();

        if (courseError) throw courseError;
        setCourse(courseData);

        // Load lessons
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('course_lessons')
          .select('*')
          .eq('course_id', id)
          .order('starts_at', { ascending: true });

        if (lessonsError) throw lessonsError;
        setLessons(lessonsData || []);
      } catch (error) {
        console.error('Error loading course:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadCourse();
    }
  }, [id]);

  const handleBuyCourse = async () => {
    if (!course) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('create-course-payment', {
        body: { course_id: course.id }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Kunde inte skapa betalning. Försök igen.');
    }
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      beginner: 'Nybörjare',
      intermediate: 'Medel',
      advanced: 'Avancerad',
    };
    return labels[level] || level;
  };

  if (loading) {
    return <div className="text-center py-12">{sv.common.loading}</div>;
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Kursen hittades inte</p>
        <Button onClick={() => navigate('/kurser-poang')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka till kurser
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/kurser-poang')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Tillbaka till kurser
      </Button>

      <Card className="shadow-lg overflow-hidden">
        {course.image_url && (
          <div className="relative w-full aspect-[21/9] overflow-hidden">
            <img 
              src={course.image_url} 
              alt={course.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-4xl mb-2">{course.title}</CardTitle>
              <Badge variant="secondary">
                {getLevelLabel(course.level)}
              </Badge>
            </div>
          </div>
          {course.description && (
            <CardDescription className="mt-4 text-base">
              {course.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Course Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Antal lektioner</p>
                <p className="text-xl font-semibold">{lessons.length} lektioner</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Kapacitet</p>
                <p className="text-xl font-semibold">{course.capacity} platser</p>
              </div>
            </div>

            {course.venue && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <MapPin className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Plats</p>
                  <p className="text-xl font-semibold">{course.venue}</p>
                </div>
              </div>
            )}

            {course.profiles && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <User className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Instruktör</p>
                  <p className="text-xl font-semibold">{course.profiles.full_name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Lessons Schedule */}
          {lessons.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Lektionsschema</h3>
              <div className="space-y-2">
                {lessons.map((lesson: any, index: number) => (
                  <Card key={lesson.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium">
                          {lesson.title || `Lektion ${index + 1}`}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(lesson.starts_at), 'EEEE d MMM', { locale: svLocale })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(lesson.starts_at), 'HH:mm')}
                            {lesson.ends_at && ` - ${format(new Date(lesson.ends_at), 'HH:mm')}`}
                          </span>
                          {lesson.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {lesson.venue}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pricing & Tickets */}
          <Card className="gradient-primary text-white">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 mb-1">Pris</p>
                  <p className="text-4xl font-bold">{course.price_cents / 100} kr</p>
                </div>
                <div className="text-right">
                  <p className="text-white/80 mb-1">Klippkort ingår</p>
                  <div className="flex items-center gap-2 justify-end">
                    <Ticket className="h-8 w-8" />
                    <p className="text-4xl font-bold">{lessons.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Explanation */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold">Flexibla klippkort</p>
                  <p className="text-muted-foreground">
                    Denna kurs ger dig {lessons.length} klippkort som kan användas för alla lektioner, 
                    inte bara denna kurs. Klippkorten utgår {course.ends_at ? format(new Date(course.ends_at), 'PPP', { locale: svLocale }) : 'vid kursens slut'}.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Period */}
          {(course.starts_at || course.ends_at) && (
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-2">Kursperiod</p>
              <p className="text-lg font-medium">
                {course.starts_at && format(new Date(course.starts_at), 'PPP', { locale: svLocale })}
                {course.ends_at && ` - ${format(new Date(course.ends_at), 'PPP', { locale: svLocale })}`}
              </p>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            variant="hero" 
            size="lg"
            className="flex-1"
            onClick={handleBuyCourse}
          >
            Köp kurs för {course.price_cents / 100} SEK
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => navigate('/kurser-poang')}
          >
            Se fler kurser
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
