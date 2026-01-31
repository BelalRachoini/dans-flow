-- Create the course-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-images', 'course-images', true);

-- Allow authenticated users to upload course images
CREATE POLICY "Authenticated users can upload course images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-images');

-- Allow public read access to course images
CREATE POLICY "Public can view course images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update course images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-images');

-- Allow authenticated users to delete course images
CREATE POLICY "Authenticated users can delete course images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-images');