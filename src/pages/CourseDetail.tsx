import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, User, Clock, Coins, ShoppingCart, ArrowLeft } from 'lucide-react';
import { listCourses } from '@/services/mockApi';
import { useCartStore } from '@/store/cartStore';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import type { Course } from '@/types';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const courses = await listCourses();
        const foundCourse = courses.find((c) => c.id === id);
        setCourse(foundCourse || null);
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id]);

  const handleBuyCourse = () => {
    if (!course) return;
    
    addItem({
      id: `course-${course.id}`,
      type: 'course',
      itemId: course.id,
      name: course.title,
      priceSEK: course.priceSEK,
      quantity: 1,
    });
    toast.success(`${course.title} tillagd i varukorg!`);
  };

  const getStyleColor = (style: string) => {
    const colors: Record<string, string> = {
      Salsa: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      Bachata: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      Tango: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      Kizomba: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      Zouk: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      HipHop: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[style] || 'bg-gray-100 text-gray-700';
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

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-4xl mb-2">{course.title}</CardTitle>
              <Badge className={getStyleColor(course.style)} variant="secondary">
                {sv.styles[course.style]}
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
                <p className="text-xl font-semibold">{course.totalLessons} lektioner</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Schema</p>
                <p className="text-xl font-semibold">
                  {['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'][course.dayOfWeek]} {course.time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <MapPin className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Plats</p>
                <p className="text-xl font-semibold">{course.location}</p>
              </div>
            </div>

            {course.instructorId && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <User className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Instruktör</p>
                  <p className="text-xl font-semibold">Instruktör tilldelad</p>
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Points */}
          <Card className="gradient-primary text-white">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 mb-1">Pris</p>
                  <p className="text-4xl font-bold">{course.priceSEK} kr</p>
                </div>
                <div className="text-right">
                  <p className="text-white/80 mb-1">Poäng du får</p>
                  <div className="flex items-center gap-2 justify-end">
                    <Coins className="h-8 w-8" />
                    <p className="text-4xl font-bold">+{course.totalLessons}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Period */}
          <div className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-2">Kursperiod</p>
            <p className="text-lg font-medium">
              {new Date(course.startDate).toLocaleDateString('sv-SE')} - {new Date(course.endDate).toLocaleDateString('sv-SE')}
            </p>
          </div>

          {/* Info Banner */}
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Coins className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <p className="font-semibold mb-1">Så fungerar poängsystemet</p>
                  <p className="text-sm text-muted-foreground">
                    Köp en kurs – få lika många poäng som lektioner. Varje gång du checkar in på en lektion 
                    dras 1 poäng. Poängen är flexibla och kan användas i vilken klass som helst, 
                    oavsett stil eller nivå!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            variant="hero" 
            size="lg"
            className="flex-1"
            onClick={handleBuyCourse}
          >
            <ShoppingCart size={20} className="mr-2" />
            Lägg till i varukorg
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
