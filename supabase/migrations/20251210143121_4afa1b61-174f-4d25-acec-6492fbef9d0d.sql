-- Update training-materials bucket to allow video files and increase size limit
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
  file_size_limit = 524288000  -- 500MB in bytes
WHERE id = 'training-materials';