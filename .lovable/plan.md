

# Fix Event Image Upload

## Problem
The Events admin form only has a plain text input for `image_url` — no file upload. Users can only paste a URL, which is why they can't upload an image. Courses already have a working uploader (`CourseImageUploader`) that supports both file upload (to Supabase Storage) and pasting a URL.

## Fix

### 1. Make `CourseImageUploader` reusable
Rename the component to `ImageUploader` and add an optional `pathPrefix` prop (default `"courses"`).

- **New file**: `src/components/ImageUploader.tsx` — copy of `CourseImageUploader` with:
  - Renamed export `ImageUploader`
  - New prop `pathPrefix?: string` (defaults to `'courses'`) used in `const filePath = ${pathPrefix}/${fileName}`
  - New prop `label?: string` to override the "Course Image" label
- **Update** `src/pages/Courses.tsx` to import and use `ImageUploader` instead of `CourseImageUploader`.
- **Delete** `src/components/CourseImageUploader.tsx`.

> Reuses existing public `course-images` bucket (already configured, public). No new bucket or RLS migration needed. Event images will live under the `events/` path inside that bucket.

### 2. Replace the plain URL input on the Events form
In `src/pages/Events.tsx` around lines 681–685, replace:
```tsx
<Label htmlFor="image_url">{t.events.imageUrl}</Label>
<Input id="image_url" {...register('image_url')} placeholder="https://..." />
```
with:
```tsx
<ImageUploader
  value={watch('image_url') || ''}
  onChange={(url) => setValue('image_url', url, { shouldValidate: true })}
  pathPrefix="events"
  label={t.events.imageUrl}
/>
```
- Add the import at the top of `Events.tsx`.
- Keep the existing `image_url` zod schema (it already accepts any `https://...` URL, including the Supabase public storage URL).

## What stays unchanged
- Database schema, RLS, and existing event records.
- The `course-images` storage bucket (still public, still used for both courses and events).
- Courses image upload behavior (just imports a renamed component).
- All Swish/Stripe payment logic.

## Files touched
1. **Create** `src/components/ImageUploader.tsx` (generalized from `CourseImageUploader`)
2. **Delete** `src/components/CourseImageUploader.tsx`
3. **Edit** `src/pages/Courses.tsx` — swap import and component name
4. **Edit** `src/pages/Events.tsx` — replace plain URL input with `<ImageUploader pathPrefix="events" />`

