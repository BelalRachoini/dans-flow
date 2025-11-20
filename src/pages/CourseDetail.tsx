import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { CourseSectionRenderer } from '@/components/CourseSectionRenderer';
import { CourseSectionEditor } from '@/components/CourseSectionEditor';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const { t } = useLanguageStore();
  const isAdmin = role === 'admin';

  const [course, setCourse] = useState<any | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  useEffect(() => {
    const loadCourseData = async () => {
      if (!id) return;

      try {
        // Load course
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

        // Load sections
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('course_page_sections')
          .select('*')
          .eq('course_id', id)
          .eq('is_visible', true)
          .order('position', { ascending: true });

        if (sectionsError) throw sectionsError;
        setSections(sectionsData || []);
      } catch (error) {
        console.error('Error loading course:', error);
        toast.error(t.common?.error || 'Error loading course');
      } finally {
        setLoading(false);
      }
    };

    loadCourseData();
  }, [id, t]);

  const handleSaveSection = async (section: any) => {
    try {
      if (section.id) {
        // Update existing section
        const { error } = await supabase
          .from('course_page_sections')
          .update({
            section_type: section.section_type,
            title: section.title,
            content: section.content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', section.id);

        if (error) throw error;

        setSections(sections.map(s => s.id === section.id ? { ...s, ...section } : s));
        toast.success(t.course?.pageEditor?.saveSection || 'Section saved');
      } else {
        // Create new section
        const newPosition = sections.length;
        const { data, error } = await supabase
          .from('course_page_sections')
          .insert({
            course_id: id,
            section_type: section.section_type,
            title: section.title,
            content: section.content,
            position: newPosition,
          })
          .select()
          .single();

        if (error) throw error;

        setSections([...sections, data]);
        toast.success(t.course?.pageEditor?.saveSection || 'Section added');
      }

      setEditingSection(null);
      setShowAddSection(false);
    } catch (error) {
      console.error('Error saving section:', error);
      toast.error(t.common?.error || 'Error saving section');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm(t.course?.pageEditor?.confirmDelete || 'Are you sure you want to delete this section?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('course_page_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      // Update positions for remaining sections
      const remainingSections = sections.filter(s => s.id !== sectionId);
      const updatedSections = remainingSections.map((s, index) => ({ ...s, position: index }));

      // Update positions in database
      for (const section of updatedSections) {
        await supabase
          .from('course_page_sections')
          .update({ position: section.position })
          .eq('id', section.id);
      }

      setSections(updatedSections);
      toast.success(t.course?.pageEditor?.deleteSection || 'Section deleted');
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error(t.common?.error || 'Error deleting section');
    }
  };

  const handleReorderSection = async (sectionId: string, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex(s => s.id === sectionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    try {
      const reorderedSections = [...sections];
      [reorderedSections[currentIndex], reorderedSections[newIndex]] = 
        [reorderedSections[newIndex], reorderedSections[currentIndex]];

      // Update positions
      const updates = reorderedSections.map((s, index) => ({
        id: s.id,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from('course_page_sections')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      setSections(reorderedSections.map((s, index) => ({ ...s, position: index })));
      toast.success(t.course?.pageEditor?.moveUp || 'Section moved');
    } catch (error) {
      console.error('Error reordering section:', error);
      toast.error(t.common?.error || 'Error reordering section');
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t.common?.loading || 'Loading...'}</div>;
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{t.course?.notFound || 'Course not found'}</p>
        <Button onClick={() => navigate('/kurser-poang')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.course?.backToCourses || 'Back to Courses'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header with navigation and edit controls */}
      <div className="flex items-center justify-between gap-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/kurser-poang')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.course?.backToCourses || 'Back to Courses'}
        </Button>

        {isAdmin && (
          <Button
            variant={editMode ? 'default' : 'outline'}
            onClick={() => setEditMode(!editMode)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {editMode ? t.common?.done || 'Done' : t.course?.pageEditor?.editPage || 'Edit Page'}
          </Button>
        )}
      </div>

      {/* Dynamic sections */}
      <div className="space-y-6">
        {sections.map((section, index) => (
          <CourseSectionRenderer
            key={section.id}
            section={section}
            course={course}
            lessons={lessons}
            editMode={editMode}
            onEdit={() => setEditingSection(section)}
            onDelete={() => handleDeleteSection(section.id)}
            onMoveUp={index > 0 ? () => handleReorderSection(section.id, 'up') : undefined}
            onMoveDown={index < sections.length - 1 ? () => handleReorderSection(section.id, 'down') : undefined}
          />
        ))}
      </div>

      {/* Add Section button (only in edit mode) */}
      {editMode && (
        <Button
          variant="outline"
          size="lg"
          className="w-full border-dashed"
          onClick={() => setShowAddSection(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.course?.pageEditor?.addSection || 'Add Section'}
        </Button>
      )}

      {/* Section Editor Dialog */}
      {(editingSection || showAddSection) && (
        <CourseSectionEditor
          section={editingSection}
          course={course}
          open={true}
          onSave={handleSaveSection}
          onClose={() => {
            setEditingSection(null);
            setShowAddSection(false);
          }}
        />
      )}
    </div>
  );
}
