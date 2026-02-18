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
import { CourseImageUploader } from '@/components/CourseImageUploader';
import { CourseClasses } from '@/components/CourseClasses';
import { Calendar, Plus, PartyPopper, Edit, Trash2, CalendarIcon, Clock, Copy, Package, Percent } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional().nullable(),
  price: z.number().min(1),
  capacity: z.number().min(1),
  instructors: z.array(z.string()).default([]),
  primary_instructor: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  starts_at: z.date().optional(),
  ends_at: z.date().optional(),
  course_type: z.enum(['regular', 'package', 'bundle']).default('regular'),
  is_package: z.boolean().default(false),
  max_selections: z.number().min(1).max(20).optional(),
  show_on_calendar: z.boolean().default(true),
  discount_enabled: z.boolean().default(false),
  discount_type: z.enum(['none', 'percent', 'amount']).default('none'),
  discount_value: z.number().min(0).default(0),
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
  discount_type?: string;
  discount_value?: number;
  course_type?: string;
  is_package?: boolean;
  max_selections?: number;
};

// Helper function to calculate discounted price
const calculateDisplayPrice = (course: DbCourse): { original: number; final: number; hasDiscount: boolean } => {
  const original = course.price_cents;
  let final = original;
  
  if (course.discount_type === 'percent' && course.discount_value && course.discount_value > 0) {
    final = Math.round(original * (1 - course.discount_value / 100));
  } else if (course.discount_type === 'amount' && course.discount_value && course.discount_value > 0) {
    final = Math.max(original - course.discount_value, 100);
  }
  
  return { original, final, hasDiscount: final < original };
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

  const [discountEnabled, setDiscountEnabled] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      level: undefined,
      status: 'published',
      capacity: 20,
      price: 1000,
      instructors: [],
      course_type: 'regular',
      is_package: false,
      max_selections: 2,
      show_on_calendar: true,
      discount_enabled: false,
      discount_type: 'none',
      discount_value: 0,
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
        
        const instructors = courseInstructors
          ?.filter((ci: any) => ci.profiles !== null)
          .map((ci: any) => ({
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
      // Validate discount
      if (data.discount_enabled) {
        if (data.discount_type === 'percent' && (data.discount_value < 1 || data.discount_value > 90)) {
          toast.error('Rabatt i procent måste vara mellan 1% och 90%');
          return;
        }
        if (data.discount_type === 'amount') {
          const discountCents = Math.round(data.discount_value * 100);
          const priceCents = Math.round(data.price * 100);
          if (discountCents >= priceCents) {
            toast.error('Rabattbeloppet kan inte vara lika med eller större än priset');
            return;
          }
        }
      }

      // Determine is_package based on course_type for backwards compatibility
      const isPackageOrBundle = data.course_type === 'package' || data.course_type === 'bundle';

      const courseData = {
        title: data.title,
        image_url: data.image_url || null,
        description: data.description,
        level: data.level || 'beginner',
        price_cents: Math.round(data.price * 100),
        capacity: data.capacity,
        primary_instructor: data.primary_instructor || null,
        status: data.status,
        starts_at: data.starts_at?.toISOString() || null,
        ends_at: data.ends_at?.toISOString() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        course_type: data.course_type,
        is_package: isPackageOrBundle,
        max_selections: isPackageOrBundle ? data.max_selections : null,
        show_on_calendar: data.show_on_calendar,
        discount_type: data.discount_enabled ? data.discount_type : 'none',
        discount_value: data.discount_enabled 
          ? (data.discount_type === 'amount' ? Math.round(data.discount_value * 100) : data.discount_value) 
          : 0,
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
    
    // Set course_type from database or derive from is_package
    const courseType = course.course_type as 'regular' | 'package' | 'bundle' || (course.is_package ? 'package' : 'regular');
    setValue('course_type', courseType);
    setValue('is_package', course.is_package || false);
    setValue('max_selections', course.max_selections || 2);
    setValue('show_on_calendar', (course as any).show_on_calendar ?? true);
    
    // Handle discount fields
    const hasDiscount = course.discount_type && course.discount_type !== 'none';
    setDiscountEnabled(hasDiscount);
    setValue('discount_enabled', hasDiscount);
    setValue('discount_type', (course.discount_type as 'none' | 'percent' | 'amount') || 'none');
    setValue('discount_value', course.discount_type === 'amount' 
      ? (course.discount_value || 0) / 100 
      : (course.discount_value || 0));
    
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

  const handleDuplicate = async (course: DbCourse) => {
    try {
      toast.loading(t.common.duplicating, { id: 'duplicate-course' });

      // Create duplicate course with modified title and reset dates
      const courseData = {
        title: `${course.title} (Kopia)`,
        image_url: course.image_url,
        description: course.description,
        level: course.level,
        price_cents: course.price_cents,
        capacity: course.capacity,
        primary_instructor: course.primary_instructor,
        status: 'draft', // Set to draft so admin can review before publishing
        starts_at: null,
        ends_at: null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      const { data: newCourse, error: courseError } = await supabase
        .from('courses' as any)
        .insert([courseData])
        .select()
        .single();

      if (courseError) throw courseError;
      if (!newCourse) throw new Error('Failed to create course');

      const newCourseId = (newCourse as any).id;

      // Delete auto-generated sections (trigger creates defaults we don't want when duplicating)
      await supabase
        .from('course_page_sections' as any)
        .delete()
        .eq('course_id', newCourseId);

      // Duplicate course instructors
      if (course.instructors && course.instructors.length > 0) {
        const instructorsToInsert = course.instructors.map((instructor) => ({
          course_id: newCourseId,
          instructor_id: instructor.id,
          is_primary: instructor.is_primary
        }));

        const { error: instructorsError } = await supabase
          .from('course_instructors' as any)
          .insert(instructorsToInsert);

        if (instructorsError) throw instructorsError;
      }

      // Duplicate course page sections
      const { data: sections, error: sectionsError } = await supabase
        .from('course_page_sections' as any)
        .select('*')
        .eq('course_id', course.id);

      if (sectionsError) throw sectionsError;

      if (sections && sections.length > 0) {
        const sectionsToInsert = sections.map((section: any) => ({
          course_id: newCourseId,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          position: section.position,
          is_visible: section.is_visible
        }));

        const { error: insertSectionsError } = await supabase
          .from('course_page_sections' as any)
          .insert(sectionsToInsert);

        if (insertSectionsError) throw insertSectionsError;
      }

      toast.success(t.common.duplicated, { id: 'duplicate-course' });
      loadData();
      
      // Navigate to the new course detail page
      navigate(`/kurser-poang/${newCourseId}`);
    } catch (error) {
      console.error('Error duplicating course:', error);
      toast.error(t.common.error, { id: 'duplicate-course' });
    }
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

                <CourseImageUploader
                  value={watch('image_url') || ''}
                  onChange={(url) => setValue('image_url', url)}
                />

                <div>
                  <Label htmlFor="description">{t.course.description}</Label>
                  <Textarea id="description" {...register('description')} rows={4} />
                  {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                </div>

                <div>
                  <Label htmlFor="level">{t.course.level} ({t.common.optional})</Label>
                  <Select
                    value={watch('level') || 'none'}
                    onValueChange={(value) => setValue('level', value === 'none' ? undefined : value as 'beginner' | 'intermediate' | 'advanced')}
                  >
                    <SelectTrigger id="level">
                      <SelectValue placeholder={t.course.levelPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.course.levelNone}</SelectItem>
                      <SelectItem value="beginner">{t.course.levelBeginner}</SelectItem>
                      <SelectItem value="intermediate">{t.course.levelIntermediate}</SelectItem>
                      <SelectItem value="advanced">{t.course.levelAdvanced}</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.level && <p className="text-sm text-destructive mt-1">{errors.level.message}</p>}
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

                {/* Course type options */}
                <div className="pt-4 border-t space-y-4">
                  <div>
                    <Label htmlFor="course_type">Kurstyp</Label>
                    <Select 
                      onValueChange={(value: 'regular' | 'package' | 'bundle') => {
                        setValue('course_type', value);
                        setValue('is_package', value === 'package' || value === 'bundle');
                      }} 
                      value={watch('course_type')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Standard</SelectItem>
                        <SelectItem value="package">Paket</SelectItem>
                        <SelectItem value="bundle">All-in-One</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      {watch('course_type') === 'regular' && 'En vanlig kurs med lektioner'}
                      {watch('course_type') === 'package' && 'Kunden väljer klasser från en fast pool'}
                      {watch('course_type') === 'bundle' && 'Kunden väljer paket (t.ex. Bronze, Silver, Gold) och sedan klasser'}
                    </p>
                  </div>
                  
                  {(watch('course_type') === 'package') && (
                    <div>
                      <Label htmlFor="max_selections">Max antal klasser kunden kan välja</Label>
                      <Input
                        id="max_selections"
                        type="number"
                        min={1}
                        max={20}
                        {...register('max_selections', { valueAsNumber: true })}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Kunden väljer t.ex. 2 av 5 tillgängliga klasser
                      </p>
                    </div>
                  )}
                  
                  {watch('course_type') === 'bundle' && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        💡 Spara kursen först, sedan kan du hantera paketernivåer (Bronze, Silver, Gold etc.) på kurssidan.
                      </p>
                    </div>
                  )}
                </div>

                {/* Discount options */}
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="discount_enabled" className="font-normal">
                        Aktivera rabatt
                      </Label>
                    </div>
                    <Switch
                      id="discount_enabled"
                      checked={discountEnabled}
                      onCheckedChange={(checked) => {
                        setDiscountEnabled(checked);
                        setValue('discount_enabled', checked);
                        if (!checked) {
                          setValue('discount_type', 'none');
                          setValue('discount_value', 0);
                        } else {
                          setValue('discount_type', 'percent');
                        }
                      }}
                    />
                  </div>
                  
                  {discountEnabled && (
                    <div className="space-y-3">
                      <div>
                        <Label>Rabattyp</Label>
                        <Select
                          value={watch('discount_type')}
                          onValueChange={(v) => {
                            setValue('discount_type', v as 'none' | 'percent' | 'amount');
                            setValue('discount_value', 0);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Procent (%)</SelectItem>
                            <SelectItem value="amount">Fast belopp (kr)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="discount_value">
                          {watch('discount_type') === 'percent' ? 'Rabatt i %' : 'Rabatt i kr'}
                        </Label>
                        <Input
                          id="discount_value"
                          type="number"
                          min={0}
                          max={watch('discount_type') === 'percent' ? 90 : undefined}
                          placeholder={watch('discount_type') === 'percent' ? 'T.ex. 20' : 'T.ex. 200'}
                          value={watch('discount_value') || ''}
                          onChange={(e) => setValue('discount_value', Number(e.target.value))}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          {watch('discount_type') === 'percent' 
                            ? 'Ange rabatt mellan 1-90%' 
                            : 'Ange belopp i kronor'}
                        </p>
                      </div>
                      
                      {watch('discount_value') > 0 && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Ordinarie pris: </span>
                            <span className="line-through">{watch('price')} kr</span>
                          </p>
                          <p className="text-sm font-medium text-green-600">
                            <span className="text-muted-foreground">Rabatterat pris: </span>
                            {watch('discount_type') === 'percent'
                              ? Math.round(watch('price') * (1 - watch('discount_value') / 100))
                              : Math.max(watch('price') - watch('discount_value'), 1)
                            } kr
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Calendar visibility option */}
                <div className="flex items-center space-x-3 py-3 border-t">
                  <Checkbox
                    id="show_on_calendar"
                    checked={watch('show_on_calendar')}
                    onCheckedChange={(checked) => setValue('show_on_calendar', checked === true)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="show_on_calendar" className="font-medium cursor-pointer">
                      Visa på kalender/schema
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Om avmarkerat kommer kursens lektioner inte visas på den publika kalendern
                    </p>
                  </div>
                </div>
                {editingCourse && (
                  <div className="pt-4 border-t">
                    {watch('is_package') ? (
                      <CourseClasses
                        courseId={editingCourse.id}
                        courseStartDate={watch('starts_at')}
                        courseEndDate={watch('ends_at')}
                      />
                    ) : (
                      <CourseLessons 
                        courseId={editingCourse.id}
                        courseStartDate={watch('starts_at')}
                        courseEndDate={watch('ends_at')}
                      />
                    )}
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
              <CardHeader className="p-2 sm:p-3 md:p-4 pb-2 sm:pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm sm:text-base md:text-lg line-clamp-2">
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
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(course); }}
                      >
                        <Copy className="h-4 w-4" />
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
                {role === 'admin' && course.status === 'draft' && (
                  <Badge variant="outline" className="w-fit text-xs">
                    {t.events.statusDraft}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-2 sm:p-3 md:p-4 pt-0 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
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
                    {(() => {
                      const pricing = calculateDisplayPrice(course);
                      return (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{t.courses.priceLabel}</span>
                          {pricing.hasDiscount ? (
                            <>
                              <span className="text-sm line-through text-muted-foreground">
                                {pricing.original / 100} kr
                              </span>
                              <span className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
                                {pricing.final / 100} kr
                              </span>
                              {course.discount_type === 'percent' && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                                  -{course.discount_value}%
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-lg sm:text-xl md:text-2xl font-bold">
                              {pricing.original / 100} kr
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
