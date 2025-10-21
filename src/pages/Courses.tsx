import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, User, Clock, Coins, ShoppingCart, Plus, PartyPopper } from 'lucide-react';
import { listCourses, listPointsTransactions, createCourse } from '@/services/mockApi';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Course, PointsTransaction } from '@/types';

const courseSchema = z.object({
  title: z.string().min(1, 'Titel krävs').max(100),
  style: z.enum(['Salsa', 'Bachata', 'Tango', 'Kizomba', 'Zouk', 'HipHop']),
  totalLessons: z.number().min(1).max(100),
  startDate: z.string().min(1, 'Startdatum krävs'),
  endDate: z.string().min(1, 'Slutdatum krävs'),
  dayOfWeek: z.number().min(0).max(6),
  time: z.string().min(1, 'Tid krävs'),
  location: z.string().min(1, 'Plats krävs'),
  description: z.string().optional(),
  priceSEK: z.number().min(0),
});

type CourseFormData = z.infer<typeof courseSchema>;

export default function Courses() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      totalLessons: 12,
      dayOfWeek: 1,
      priceSEK: 0,
    }
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const coursesData = await listCourses();
        setCourses(coursesData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCourseClick = (courseId: string) => {
    navigate(`/kurser-poang/${courseId}`);
  };

  const onSubmitCourse = async (data: CourseFormData) => {
    try {
      const newCourse = await createCourse(data as Omit<Course, 'id'>);
      setCourses([...courses, newCourse]);
      toast.success(sv.courses.createSuccess);
      setDialogOpen(false);
      reset();
    } catch (error) {
      toast.error('Något gick fel');
    }
  };

  const weekdays = [
    sv.courses.sunday,
    sv.courses.monday,
    sv.courses.tuesday,
    sv.courses.wednesday,
    sv.courses.thursday,
    sv.courses.friday,
    sv.courses.saturday,
  ];

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{sv.nav.kurserPoang}</h1>
          <p className="mt-1 text-muted-foreground">
            Köp kurser, samla poäng och delta i lektioner
          </p>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="mr-2" size={16} />
                  {sv.courses.createCourse}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{sv.courses.createCourse}</DialogTitle>
                  <DialogDescription>
                    Skapa en ny kurs för dansskolan
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmitCourse)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="title">{sv.courses.courseTitle}</Label>
                      <Input id="title" {...register('title')} />
                      {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="style">{sv.courses.style}</Label>
                      <Select onValueChange={(value) => setValue('style', value as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj stil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Salsa">Salsa</SelectItem>
                          <SelectItem value="Bachata">Bachata</SelectItem>
                          <SelectItem value="Tango">Tango</SelectItem>
                          <SelectItem value="Kizomba">Kizomba</SelectItem>
                          <SelectItem value="Zouk">Zouk</SelectItem>
                          <SelectItem value="HipHop">Hip Hop</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.style && <p className="text-sm text-destructive mt-1">{errors.style.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="totalLessons">{sv.courses.totalLessons}</Label>
                      <Input id="totalLessons" type="number" {...register('totalLessons', { valueAsNumber: true })} />
                      {errors.totalLessons && <p className="text-sm text-destructive mt-1">{errors.totalLessons.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="startDate">{sv.courses.startDate}</Label>
                      <Input id="startDate" type="date" {...register('startDate')} />
                      {errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="endDate">{sv.courses.endDate}</Label>
                      <Input id="endDate" type="date" {...register('endDate')} />
                      {errors.endDate && <p className="text-sm text-destructive mt-1">{errors.endDate.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="dayOfWeek">{sv.courses.dayOfWeek}</Label>
                      <Select onValueChange={(value) => setValue('dayOfWeek', parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj dag" />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdays.map((day, index) => (
                            <SelectItem key={index} value={index.toString()}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.dayOfWeek && <p className="text-sm text-destructive mt-1">{errors.dayOfWeek.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="time">{sv.courses.time}</Label>
                      <Input id="time" type="time" {...register('time')} />
                      {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="location">{sv.courses.location}</Label>
                      <Input id="location" {...register('location')} />
                      {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="priceSEK">{sv.courses.price}</Label>
                      <Input id="priceSEK" type="number" {...register('priceSEK', { valueAsNumber: true })} />
                      {errors.priceSEK && <p className="text-sm text-destructive mt-1">{errors.priceSEK.message}</p>}
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="description">{sv.courses.description}</Label>
                      <Textarea id="description" {...register('description')} />
                      {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      {sv.common.cancel}
                    </Button>
                    <Button type="submit" variant="hero">
                      {sv.courses.createCourse}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Courses Grid - 2 columns on all screens */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {courses.map((course) => (
          <Card 
            key={course.id} 
            className="shadow-md transition-smooth hover:shadow-lg cursor-pointer hover-scale flex flex-col overflow-hidden"
            onClick={() => handleCourseClick(course.id)}
          >
            {course.mediaUrl && (
              <div className="relative w-full aspect-video overflow-hidden">
                <img 
                  src={course.mediaUrl} 
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3">
              <CardTitle className="text-base sm:text-lg md:text-xl line-clamp-2">
                {course.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0 flex-1 flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm sm:text-base">{course.totalLessons} lektioner</span>
              </div>
              <div className="pt-3 border-t mt-auto">
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-muted-foreground">Pris:</span>
                    <span className="text-lg sm:text-xl md:text-2xl font-bold">{course.priceSEK} kr</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-muted-foreground">Poäng:</span>
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-primary">+{course.totalLessons}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events CTA Section */}
      <Card className="gradient-primary text-white shadow-xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 md:p-12">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                Missa inte våra kommande event!
              </h2>
              <p className="text-white/90 text-base sm:text-lg max-w-2xl">
                Från sociala danser till workshops och specialkvällar - upptäck alla spännande evenemang vi har att erbjuda.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 hover:text-primary border-white shadow-lg"
              onClick={() => navigate('/event')}
            >
              <PartyPopper className="mr-2 h-5 w-5" />
              Se alla event
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
