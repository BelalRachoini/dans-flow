

## Plan: Add Image Upload to Course Creation

### Overview
Replace the URL-only image input with a flexible image picker that allows admins to either **upload an image file** or **paste a URL**. This follows the same pattern already used for profile avatars.

### How It Works

**For Admins:**
- Choose between two tabs: "Upload" or "URL"
- **Upload tab**: Click to select a file or drag-and-drop (max 5MB, images only)
- **URL tab**: Paste an external image URL (current behavior)
- Preview shows the selected/uploaded image
- Can remove and re-select image

### Implementation Details

#### 1. Database: Create Storage Bucket

Create a new `course-images` storage bucket to store uploaded course images:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-images', 'course-images', true);

-- Allow authenticated users to upload
CREATE POLICY "Admins can upload course images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-images');

-- Allow public read access
CREATE POLICY "Public can view course images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-images');

-- Allow admins to delete/update
CREATE POLICY "Admins can manage course images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-images');
```

#### 2. New Component: `CourseImageUploader.tsx`

A reusable component that provides:
- **Tab switching**: "Upload" vs "URL" modes
- **File upload**: Validates image type, size (max 5MB)
- **URL input**: Validates URL format
- **Image preview**: Shows current/uploaded image
- **Clear button**: Remove selected image

```text
┌────────────────────────────────────────────────┐
│ Kursbild                                       │
├────────────────────────────────────────────────┤
│  [Ladda upp] [URL]          ← Tab buttons      │
├────────────────────────────────────────────────┤
│                                                │
│   ┌─────────────────────────────────────────┐  │
│   │                                         │  │
│   │        📷 Click to upload               │  │
│   │        or drag and drop                 │  │
│   │        (Max 5MB, JPG/PNG/WebP)          │  │
│   │                                         │  │
│   └─────────────────────────────────────────┘  │
│                                                │
│   [Preview shows here after upload/URL]        │
│                                                │
└────────────────────────────────────────────────┘
```

#### 3. Update Course Form (`Courses.tsx`)

- Replace the simple URL input with `CourseImageUploader`
- Update Zod schema to accept any string (upload returns a URL)
- Handle the image URL from either upload or direct input

#### 4. Translation Updates

Add new translation keys for:
- `uploadTab` / `urlTab` (tab labels)
- `uploadInstructions` (drag/drop text)
- `maxFileSize` (size limit message)
- `removeImage` (clear button)
- `imagePreview` (accessibility)

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `course-images` storage bucket with RLS policies |
| `src/components/CourseImageUploader.tsx` | Create | New upload/URL picker component |
| `src/pages/Courses.tsx` | Modify | Replace URL input with CourseImageUploader |
| `src/locales/sv.ts` | Modify | Add Swedish translations |
| `src/locales/en.ts` | Modify | Add English translations |
| `src/locales/es.ts` | Modify | Add Spanish translations |

### User Experience

**Before:**
```text
Bild-URL
[https://example.com/image.jpg___________]
```

**After:**
```text
Kursbild
┌─────────────────────────────────────────┐
│ [Ladda upp]  [URL]                      │
├─────────────────────────────────────────┤
│  📷 Klicka för att välja bild           │
│     eller dra och släpp                 │
│     Max 5MB • JPG, PNG, WebP            │
└─────────────────────────────────────────┘

[After uploading, shows preview with remove button]
```

### Technical Flow

```text
Admin selects file
      ↓
Validate type (image/*) and size (≤5MB)
      ↓
Upload to storage bucket 'course-images'
      ↓
Get public URL from Supabase
      ↓
Set form field image_url = publicUrl
      ↓
Course saves with URL pointing to storage
```

