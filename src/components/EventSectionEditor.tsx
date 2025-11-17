import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

interface EventSectionEditorProps {
  section: any | null;
  event: any;
  open: boolean;
  onClose: () => void;
  onSave: (section: any) => void;
}

export function EventSectionEditor({ section, event, open, onClose, onSave }: EventSectionEditorProps) {
  const [sectionType, setSectionType] = useState('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<any>({});

  useEffect(() => {
    if (section) {
      setSectionType(section.section_type);
      setTitle(section.title || '');
      setContent(section.content || {});
    } else {
      // Reset for new section
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
              Hero section will automatically use the event's title, image, date, and venue.
            </p>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label>Text Content</Label>
              <Textarea
                value={content.text || ''}
                onChange={(e) => setContent({ ...content, text: e.target.value })}
                rows={6}
                placeholder="Enter text content..."
              />
            </div>
            <div>
              <Label>Text Alignment</Label>
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
              <Label>Font Size</Label>
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
              <Label>Video URL (YouTube/Vimeo embed)</Label>
              <Input
                value={content.videoUrl || ''}
                onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>
            <div>
              <Label>Caption (optional)</Label>
              <Input
                value={content.caption || ''}
                onChange={(e) => setContent({ ...content, caption: e.target.value })}
                placeholder="Video caption..."
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label>Image URL</Label>
              <Input
                value={content.imageUrl || ''}
                onChange={(e) => setContent({ ...content, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input
                value={content.alt || ''}
                onChange={(e) => setContent({ ...content, alt: e.target.value })}
                placeholder="Image description..."
              />
            </div>
            <div>
              <Label>Layout</Label>
              <Select
                value={content.layout || 'full'}
                onValueChange={(value) => setContent({ ...content, layout: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Width</SelectItem>
                  <SelectItem value="half">Half Width</SelectItem>
                  <SelectItem value="third">Third Width</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Caption (optional)</Label>
              <Input
                value={content.caption || ''}
                onChange={(e) => setContent({ ...content, caption: e.target.value })}
                placeholder="Image caption..."
              />
            </div>
          </div>
        );

      case 'gallery':
        const images = content.images || [];
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Gallery Images</Label>
              <Button
                size="sm"
                onClick={() => setContent({
                  ...content,
                  images: [...images, { url: '', alt: '', caption: '' }]
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </Button>
            </div>
            {images.map((img: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Image {idx + 1}</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const newImages = images.filter((_: any, i: number) => i !== idx);
                      setContent({ ...content, images: newImages });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={img.url}
                  onChange={(e) => {
                    const newImages = [...images];
                    newImages[idx].url = e.target.value;
                    setContent({ ...content, images: newImages });
                  }}
                  placeholder="Image URL"
                />
                <Input
                  value={img.alt}
                  onChange={(e) => {
                    const newImages = [...images];
                    newImages[idx].alt = e.target.value;
                    setContent({ ...content, images: newImages });
                  }}
                  placeholder="Alt text"
                />
                <Input
                  value={img.caption}
                  onChange={(e) => {
                    const newImages = [...images];
                    newImages[idx].caption = e.target.value;
                    setContent({ ...content, images: newImages });
                  }}
                  placeholder="Caption (optional)"
                />
              </div>
            ))}
          </div>
        );

      case 'faq':
        const items = content.items || [];
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>FAQ Items</Label>
              <Button
                size="sm"
                onClick={() => setContent({
                  ...content,
                  items: [...items, { question: '', answer: '' }]
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add FAQ
              </Button>
            </div>
            {items.map((item: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Question {idx + 1}</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const newItems = items.filter((_: any, i: number) => i !== idx);
                      setContent({ ...content, items: newItems });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].question = e.target.value;
                    setContent({ ...content, items: newItems });
                  }}
                  placeholder="Question"
                />
                <Textarea
                  value={item.answer}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].answer = e.target.value;
                    setContent({ ...content, items: newItems });
                  }}
                  placeholder="Answer"
                  rows={3}
                />
              </div>
            ))}
          </div>
        );

      case 'booking':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show Price</Label>
              <Switch
                checked={content.showPrice !== false}
                onCheckedChange={(checked) => setContent({ ...content, showPrice: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Capacity</Label>
              <Switch
                checked={content.showCapacity !== false}
                onCheckedChange={(checked) => setContent({ ...content, showCapacity: checked })}
              />
            </div>
            <div>
              <Label>Custom Message (optional)</Label>
              <Textarea
                value={content.customMessage || ''}
                onChange={(e) => setContent({ ...content, customMessage: e.target.value })}
                placeholder="Add a promotional message..."
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{section ? 'Edit Section' : 'Add New Section'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Section Type</Label>
            <Select value={sectionType} onValueChange={setSectionType} disabled={!!section}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hero">Hero Banner</SelectItem>
                <SelectItem value="text">Text Content</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="gallery">Gallery</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="booking">Booking Form</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sectionType !== 'hero' && (
            <div>
              <Label>Section Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter section title..."
              />
            </div>
          )}

          {renderContentEditor()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
