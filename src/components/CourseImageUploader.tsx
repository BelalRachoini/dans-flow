import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Link, X, Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CourseImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function CourseImageUploader({ value, onChange, disabled }: CourseImageUploaderProps) {
  const { t } = useLanguageStore();
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(value?.startsWith('http') && !value?.includes('supabase') ? 'url' : 'upload');
  const [urlInput, setUrlInput] = useState(value?.startsWith('http') && !value?.includes('supabase') ? value : '');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t.imageUpload?.invalidType || 'Only JPG, PNG and WebP images are allowed');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t.imageUpload?.fileTooLarge || 'File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('course-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('course-images')
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success(t.imageUpload?.uploadSuccess || 'Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t.imageUpload?.uploadError || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  }, [onChange, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      try {
        new URL(urlInput.trim());
        onChange(urlInput.trim());
      } catch {
        toast.error(t.imageUpload?.invalidUrl || 'Invalid URL format');
      }
    }
  };

  const handleRemove = () => {
    onChange('');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <Label>{t.imageUpload?.courseImage || 'Course Image'}</Label>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'url')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            {t.imageUpload?.uploadTab || 'Upload'}
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2">
            <Link className="h-4 w-4" />
            {t.imageUpload?.urlTab || 'URL'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          {!value ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    {t.imageUpload?.uploadInstructions || 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.imageUpload?.maxFileSize || 'Max 5MB • JPG, PNG, WebP'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="relative">
              <img
                src={value}
                alt={t.imageUpload?.imagePreview || 'Preview'}
                className="w-full h-40 object-cover rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={handleRemove}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={disabled || isUploading}
          />
        </TabsContent>

        <TabsContent value="url" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleUrlSubmit}
              disabled={disabled || !urlInput.trim()}
            >
              {t.common.save || 'Save'}
            </Button>
          </div>
          {value && activeTab === 'url' && (
            <div className="relative">
              <img
                src={value}
                alt={t.imageUpload?.imagePreview || 'Preview'}
                className="w-full h-40 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={handleRemove}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
