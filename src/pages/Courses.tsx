import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CourseLessons } from '@/components/CourseLessons';
import { Calendar, Plus, PartyPopper, Edit, Trash2, CalendarIcon, Clock } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/languageStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const courseSchema = z.object({
  title: z.string().min(4).max(120),
  image_url: z.string().url().optional().or(z.literal('')),
  description: z.string().min(20).max(2000),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  price: z.number().min(1),
  capacity: z.number().min(1),
  instructors: z.array(z.string()).default([]),
  primary_instructor: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  starts_at: z.date().optional(),
  ends_at: z.date().optional(),
});

type CourseFormData = z.infer<typeof courseSchema>;

type DbCourse = {
  id: string;
  title: string;
  image_url: string | null;
  description: string;
  level: string;
  price_cents: number;
  capacity: number;
  primary_instructor: string | null;
  status: string;
  lesson_count?: number;
  instructors?: Array<{ id: string; full_name: string; is_primary: boolean }>;
};

export default function Courses() {
  const { role } = useAuthStore();
  const { t } = useLanguageStore();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<DbCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<DbCourse | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<{ id: string; full_name: string }[]>([]);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      level: 'beginner',
      status: 'published',
      capacity: 20,
      price: 1000,
      instructors: [],
    }
  });

  const loadData = async () => {
    try {
      // Load courses with lesson count
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // Get lesson counts and instructors
      const coursesWithCounts = await Promise.all(((coursesData as any[]) || []).map(async (course: any) => {
        const { count } = await supabase
          .from('course_lessons' as any)
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);
        
        // Get course instructors
        const { data: courseInstructors } = await supabase
          .from('course_instructors' as any)
          .select('instructor_id, is_primary, profiles:instructor_id(id, full_name)')
          .eq('course_id', course.id);
        
        const instructors = courseInstructors?.map((ci: any) => ({
          id: ci.profiles.id,
          full_name: ci.profiles.full_name,
          is_primary: ci.is_primary
        })) || [];
        
        return {
          ...course,
          lesson_count: count || 0,
          instructors
        } as DbCourse;
      }));

      setCourses(coursesWithCounts);

      // Load instructors for admin
      if (role === 'admin') {
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles' as any)
          .select('user_id')
          .eq('role', 'instructor');
        
        if (rolesError) {
          console.error('Error loading instructor roles:', rolesError);
          setInstructors([]);
        } else if (userRoles && userRoles.length > 0) {
          const instructorIds = userRoles.map((ur: any) => ur.user_id);
          const { data: instructorsData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', instructorIds);
          
          if (profilesError) {
            console.error('Error loading instructor profiles:', profilesError);
            setInstructors([]);
          } else {
            setInstructors(instructorsData || []);
          }
        } else {
          setInstructors([]);
        }
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Kunde inte ladda kurser');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const onSubmit = async (data: CourseFormData) => {
    try {
      const courseData = {
        title: data.title,
        image_url: data.image_url || null,
        description: data.description,
        level: data.level,
        price_cents: Math.round(data.price * 100),
        capacity: data.capacity,
        primary_instructor: data.primary_instructor || null,
        status: data.status,
        starts_at: data.starts_at?.toISOString() || null,
        ends_at: data.ends_at?.toISOString() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      let courseId: string;

      if (editingCourse) {
        const { error } = await supabase
          .from('courses' as any)
          .update(courseData)
          .eq('id', editingCourse.id);

        if (error) throw error;
        courseId = editingCourse.id;
        toast.success(t.course.saved);
      } else {
        const { data: newCourse, error } = await supabase
          .from('courses' as any)
          .insert([courseData])
          .select()
          .single();

        if (error) throw error;
        if (!newCourse) throw new Error('Failed to create course');
        courseId = (newCourse as any).id;
        toast.success(t.course.saved);
      }

      // Update course instructors
      // Delete existing instructors for this course
      await supabase
        .from('course_instructors' as any)
        .delete()
        .eq('course_id', courseId);

      // Insert new instructors
      if (data.instructors.length > 0) {
        const instructorsToInsert = data.instructors.map((instructorId) => ({
          course_id: courseId,
          instructor_id: instructorId,
          is_primary: instructorId === data.primary_instructor
        }));

        const { error: instructorsError } = await supabase
          .from('course_instructors' as any)
          .insert(instructorsToInsert);

        if (instructorsError) throw instructorsError;
      }

      setSheetOpen(false);
      reset();
      setEditingCourse(null);
      loadData();
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error('Kunde inte spara kurs');
    }
  };

  const handleEdit = (course: DbCourse) => {
    setEditingCourse(course);
    setValue('title', course.title);
    setValue('image_url', course.image_url || '');
    setValue('description', course.description);
    setValue('level', course.level as 'beginner' | 'intermediate' | 'advanced');
    setValue('price', course.price_cents / 100);
    setValue('capacity', course.capacity);
    setValue('instructors', course.instructors?.map(i => i.id) || []);
    setValue('primary_instructor', course.instructors?.find(i => i.is_primary)?.id || undefined);
    setValue('status', course.status as 'draft' | 'published' | 'archived');
    setValue('starts_at', (course as any).starts_at ? new Date((course as any).starts_at) : undefined);
    setValue('ends_at', (course as any).ends_at ? new Date((course as any).ends_at) : undefined);
    setSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('courses' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(t.course.deleted);
      loadData();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error(t.courses.errorDelete);
    }
    setDeleteDialog(null);
  };

  const getLevelBadge = (level: string) => {
    const labels = {
      beginner: t.course.levelBeginner,
      intermediate: t.course.levelIntermediate,
      advanced: t.course.levelAdvanced,
    };
    return labels[level as keyof typeof labels] || level;
  };

  if (loading) {
    return <div className="text-center py-12">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t.nav.kurserPoang}</h1>
          <p className="mt-1 text-muted-foreground">
            {t.courses.subtitle}
          </p>
        </div>
        {role === 'admin' && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="hero" onClick={() => { reset(); setEditingCourse(null); }}>
                <Plus className="mr-2" size={16} />
                {t.course.create}
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingCourse ? t.course.edit : t.course.create}</SheetTitle>
                <SheetDescription>
                  {t.courses.formDescription}
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">{t.course.title}</Label>
                  <Input id="title" {...register('title')} />
                  {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                </div>

                <div>
                  <Label htmlFor="image_url">{t.course.imageUrl}</Label>
                  <Input id="image_url" {...register('image_url')} placeholder="https://..." />
                  {errors.image_url && <p className="text-sm text-destructive mt-1">{errors.image_url.message}</p>}
                </div>

                <div>
                  <Label htmlFor="description">{t.course.description}</Label>
                  <Textarea id="description" {...register('description')} rows={4} />
                  {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                </div>

                <div>
                  <Label htmlFor="level">{t.course.level}</Label>
                  <Select onValueChange={(value) => setValue('level', value as any)} value={watch('level')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t.course.levelBeginner}</SelectItem>
                      <SelectItem value="intermediate">{t.course.levelIntermediate}</SelectItem>
                      <SelectItem value="advanced">{t.course.levelAdvanced}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">{t.course.price} (kr)</Label>
                    <Input id="price" type="number" {...register('price', { valueAsNumber: true })} />
                    {errors.price && <p className="text-sm text-destructive mt-1">{errors.price.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="capacity">{t.course.capacity}</Label>
                    <Input id="capacity" type="number" {...register('capacity', { valueAsNumber: true })} />
                    {errors.capacity && <p className="text-sm text-destructive mt-1">{errors.capacity.message}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="instructors">{t.courses.instructors}</Label>
                  <MultiSelect
                    options={instructors.map((instructor) => ({
                      label: instructor.full_name,
                      value: instructor.id
                    }))}
                    selected={watch('instructors') || []}
                    onChange={(values) => {
                      setValue('instructors', values);
                      // Reset primary instructor if it's not in the selected list
                      if (watch('primary_instructor') && !values.includes(watch('primary_instructor')!)) {
                        setValue('primary_instructor', undefined);
                      }
                    }}
                    placeholder={t.courses.selectInstructors}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {watch('instructors')?.length || 0} {t.courses.selectedInstructors}
                  </p>
                </div>

                {watch('instructors') && watch('instructors').length > 1 && (
                  <div>
                    <Label htmlFor="primary_instructor">{t.courses.primaryInstructor}</Label>
                    <Select 
                      onValueChange={(value) => setValue('primary_instructor', value === 'none' ? undefined : value)} 
                      value={watch('primary_instructor') || 'none'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.courses.selectPrimaryInstructor} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t.courses.noPrimary}</SelectItem>
                        {watch('instructors')?.map((instructorId) => {
                          const instructor = instructors.find((i) => i.id === instructorId);
                          return instructor ? (
                            <SelectItem key={instructor.id} value={instructor.id}>
                              {instructor.full_name}
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">{t.courses.primaryInstructorHelp}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="status">{t.course.status}</Label>
                  <Select onValueChange={(value) => setValue('status', value as any)} value={watch('status')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t.course.statusDraft}</SelectItem>
                      <SelectItem value="published">{t.course.statusPublished}</SelectItem>
                      <SelectItem value="archived">{t.course.statusArchived}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t.courses.startDateTime}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !watch('starts_at') && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watch('starts_at') ? format(watch('starts_at')!, "PPP HH:mm") : <span>{t.courses.selectDateTime}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={watch('starts_at')}
                        onSelect={(date) => {
                          if (date) {
                            // Preserve time if already set
                            const currentTime = watch('starts_at');
                            if (currentTime) {
                              date.setHours(currentTime.getHours(), currentTime.getMinutes());
                            }
                            setValue('starts_at', date);
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="p-3 border-t">
                        <Label className="text-sm">{t.courses.timeLabel}</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            placeholder="HH"
                            value={watch('starts_at')?.getHours() ?? ''}
                            onChange={(e) => {
                              const date = watch('starts_at') || new Date();
                              date.setHours(parseInt(e.target.value) || 0);
                              setValue('starts_at', new Date(date));
                            }}
                            className="w-20"
                          />
                          <span className="self-center">:</span>
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="MM"
                            value={watch('starts_at')?.getMinutes() ?? ''}
                            onChange={(e) => {
                              const date = watch('starts_at') || new Date();
                              date.setMinutes(parseInt(e.target.value) || 0);
                              setValue('starts_at', new Date(date));
                            }}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>{t.courses.endDateTime}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !watch('ends_at') && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watch('ends_at') ? format(watch('ends_at')!, "PPP HH:mm") : <span>{t.courses.selectDateTime}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={watch('ends_at')}
                        onSelect={(date) => {
                          if (date) {
                            // Preserve time if already set
                            const currentTime = watch('ends_at');
                            if (currentTime) {
                              date.setHours(currentTime.getHours(), currentTime.getMinutes());
                            }
                            setValue('ends_at', date);
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="p-3 border-t">
                        <Label className="text-sm">{t.courses.timeLabel}</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            placeholder="HH"
                            value={watch('ends_at')?.getHours() ?? ''}
                            onChange={(e) => {
                              const date = watch('ends_at') || new Date();
                              date.setHours(parseInt(e.target.value) || 0);
                              setValue('ends_at', new Date(date));
                            }}
                            className="w-20"
                          />
                          <span className="self-center">:</span>
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="MM"
                            value={watch('ends_at')?.getMinutes() ?? ''}
                            onChange={(e) => {
                              const date = watch('ends_at') || new Date();
                              date.setMinutes(parseInt(e.target.value) || 0);
                              setValue('ends_at', new Date(date));
                            }}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {editingCourse && (
                  <div className="pt-4 border-t">
                    <CourseLessons 
                      courseId={editingCourse.id}
                      courseStartDate={watch('starts_at')}
                      courseEndDate={watch('ends_at')}
                    />
                  </div>
                )}

                <SheetFooter>
                  <Button type="button" variant="outline" onClick={() => { setSheetOpen(false); reset(); setEditingCourse(null); }}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" variant="hero">
                    {t.common.save}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">{t.course.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="shadow-md transition-smooth hover:shadow-lg cursor-pointer hover-scale flex flex-col overflow-hidden"
              onClick={() => navigate(`/kurser-poang/${course.id}`)}
            >
              {course.image_url && (
                <div className="relative w-full aspect-video overflow-hidden">
                  <img
                    src={course.image_url}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg md:text-xl line-clamp-2">
                    {course.title}
                  </CardTitle>
                  {role === 'admin' && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEdit(course); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteDialog(course.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <Badge className="w-fit text-xs" variant="secondary">
                  {getLevelBadge(course.level)}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm sm:text-base">{course.lesson_count || 0} {t.courses.lessonsCount}</span>
                  </div>
                  {course.instructors && course.instructors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.instructors.map((instructor) => (
                        <Badge 
                          key={instructor.id} 
                          variant={instructor.is_primary ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {instructor.full_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t mt-auto">
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-muted-foreground">{t.courses.priceLabel}</span>
                      <span className="text-lg sm:text-xl md:text-2xl font-bold">{course.price_cents / 100} kr</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="gradient-primary text-white shadow-xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 md:p-12">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {t.courses.upcomingEventsTitle}
              </h2>
              <p className="text-white/90 text-base sm:text-lg max-w-2xl">
                {t.courses.upcomingEventsDescription}
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="bg-white text-primary hover:bg-white/90 hover:text-primary border-white shadow-lg"
              onClick={() => navigate('/event')}
            >
              <PartyPopper className="mr-2 h-5 w-5" />
              {t.courses.viewAllEvents}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.course.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.courses.deleteConfirmation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDialog && handleDelete(deleteDialog)}>
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
