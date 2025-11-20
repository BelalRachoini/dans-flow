import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguageStore } from '@/store/languageStore';

interface CourseSectionEditorProps {
  section: any | null;
  course: any;
  open: boolean;
  onClose: () => void;
  onSave: (section: any) => void;
}

export function CourseSectionEditor({ section, course, open, onClose, onSave }: CourseSectionEditorProps) {
  const { t } = useLanguageStore();
  const [sectionType, setSectionType] = useState('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<any>({});

  useEffect(() => {
    if (section) {
      setSectionType(section.section_type);
      setTitle(section.title || '');
      setContent(section.content || {});
    } else {
      setSectionType('text');
      setTitle('');
      setContent({});
    }
  }, [section, open]);

  const handleSave = () => {
    onSave({
      id: section?.id,
      section_type: sectionType,
      title,
      content,
    });
  };

  const renderContentEditor = () => {
    switch (sectionType) {
      case 'hero':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.course.pageEditor?.heroDescription || "Hero section will automatically use the course's title, image, level, instructor, and dates."}
            </p>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t.course.pageEditor?.textContent || 'Text Content'}</Label>
              <Textarea
                value={content.text || ''}
                onChange={(e) => setContent({ ...content, text: e.target.value })}
                rows={6}
                placeholder={t.course.pageEditor?.textPlaceholder || 'Enter text content...'}
              />
            </div>
            <div>
              <Label>{t.course.pageEditor?.textAlignment || 'Text Alignment'}</Label>
              <Select
                value={content.alignment || 'left'}
                onValueChange={(value) => setContent({ ...content, alignment: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.course.pageEditor?.fontSize || 'Font Size'}</Label>
              <Select
                value={content.fontSize || 'medium'}
                onValueChange={(value) => setContent({ ...content, fontSize: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t.course.pageEditor?.videoUrl || 'Video URL (YouTube/Vimeo embed)'}</Label>
              <Input
                value={content.videoUrl || ''}
                onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>
            <div>
              <Label>{t.course.pageEditor?.aspectRatio || 'Aspect Ratio'}</Label>
              <Select
                value={content.aspectRatio || '16/9'}
                onValueChange={(value) => setContent({ ...content, aspectRatio: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16/9">16:9 (Widescreen)</SelectItem>
                  <SelectItem value="4/3">4:3 (Standard)</SelectItem>
                  <SelectItem value="1/1">1:1 (Square)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t.course.pageEditor?.imageUrl || 'Image URL'}</Label>
              <Input
                value={content.imageUrl || ''}
                onChange={(e) => setContent({ ...content, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>{t.course.pageEditor?.altText || 'Alt Text'}</Label>
              <Input
                value={content.alt || ''}
                onChange={(e) => setContent({ ...content, alt: e.target.value })}
                placeholder="Describe the image"
              />
            </div>
            <div>
              <Label>{t.course.pageEditor?.caption || 'Caption (optional)'}</Label>
              <Input
                value={content.caption || ''}
                onChange={(e) => setContent({ ...content, caption: e.target.value })}
              />
            </div>
          </div>
        );

      case 'gallery':
        return (
          <div className="space-y-4">
            <Label>{t.course.pageEditor?.galleryImages || 'Images'}</Label>
            {(content.images || []).map((img: any, idx: number) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    placeholder="Image URL"
                    value={img.url || ''}
                    onChange={(e) => {
                      const newImages = [...(content.images || [])];
                      newImages[idx] = { ...img, url: e.target.value };
                      setContent({ ...content, images: newImages });
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Caption"
                    value={img.caption || ''}
                    onChange={(e) => {
                      const newImages = [...(content.images || [])];
                      newImages[idx] = { ...img, caption: e.target.value };
                      setContent({ ...content, images: newImages });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newImages = (content.images || []).filter((_: any, i: number) => i !== idx);
                    setContent({ ...content, images: newImages });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setContent({
                  ...content,
                  images: [...(content.images || []), { url: '', caption: '' }],
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t.course.pageEditor?.addImage || 'Add Image'}
            </Button>
          </div>
        );

      case 'faq':
        return (
          <div className="space-y-4">
            <Label>{t.course.pageEditor?.faqItems || 'FAQ Items'}</Label>
            {(content.items || []).map((item: any, idx: number) => (
              <div key={idx} className="space-y-2 p-4 border rounded-lg">
                <div>
                  <Label>{t.course.pageEditor?.question || 'Question'}</Label>
                  <Input
                    value={item.question || ''}
                    onChange={(e) => {
                      const newItems = [...(content.items || [])];
                      newItems[idx] = { ...item, question: e.target.value };
                      setContent({ ...content, items: newItems });
                    }}
                  />
                </div>
                <div>
                  <Label>{t.course.pageEditor?.answer || 'Answer'}</Label>
                  <Textarea
                    value={item.answer || ''}
                    onChange={(e) => {
                      const newItems = [...(content.items || [])];
                      newItems[idx] = { ...item, answer: e.target.value };
                      setContent({ ...content, items: newItems });
                    }}
                    rows={3}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newItems = (content.items || []).filter((_: any, i: number) => i !== idx);
                    setContent({ ...content, items: newItems });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t.course.pageEditor?.removeItem || 'Remove'}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setContent({
                  ...content,
                  items: [...(content.items || []), { question: '', answer: '' }],
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t.course.pageEditor?.addFaqItem || 'Add FAQ Item'}
            </Button>
          </div>
        );

      case 'booking':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.course.pageEditor?.bookingDescription || "Booking section will automatically display course pricing, ticket information, lesson schedule, and enrollment button."}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {section ? (t.course.pageEditor?.editSection || 'Edit Section') : (t.course.pageEditor?.addSection || 'Add Section')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t.course.pageEditor?.sectionType || 'Section Type'}</Label>
            <Select value={sectionType} onValueChange={setSectionType} disabled={!!section}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hero">{t.course.pageEditor?.hero || 'Hero'}</SelectItem>
                <SelectItem value="text">{t.course.pageEditor?.text || 'Text'}</SelectItem>
                <SelectItem value="video">{t.course.pageEditor?.video || 'Video'}</SelectItem>
                <SelectItem value="image">{t.course.pageEditor?.image || 'Image'}</SelectItem>
                <SelectItem value="gallery">{t.course.pageEditor?.gallery || 'Gallery'}</SelectItem>
                <SelectItem value="faq">{t.course.pageEditor?.faq || 'FAQ'}</SelectItem>
                <SelectItem value="booking">{t.course.pageEditor?.booking || 'Booking'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sectionType !== 'hero' && sectionType !== 'booking' && (
            <div>
              <Label>{t.course.pageEditor?.sectionTitle || 'Section Title (optional)'}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.course.pageEditor?.titlePlaceholder || 'Enter section title...'}
              />
            </div>
          )}

          {renderContentEditor()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave}>
            {t.course.pageEditor?.saveSection || 'Save Section'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
