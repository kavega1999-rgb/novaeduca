-- Create storage bucket for training materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-materials',
  'training-materials',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
);

-- Policy: Anyone can view training materials (public bucket)
CREATE POLICY "Anyone can view training materials"
ON storage.objects
FOR SELECT
USING (bucket_id = 'training-materials');

-- Policy: Admins and leaders can upload training materials
CREATE POLICY "Admins and leaders can upload training materials"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'training-materials' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'leader'::app_role)
  )
);

-- Policy: Admins and leaders can update training materials
CREATE POLICY "Admins and leaders can update training materials"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'training-materials' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'leader'::app_role)
  )
);

-- Policy: Admins and leaders can delete training materials
CREATE POLICY "Admins and leaders can delete training materials"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'training-materials' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'leader'::app_role)
  )
);