-- Update storage bucket to allow CORS
UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg']
WHERE id = 'training-materials';

-- Ensure CORS is properly configured for the bucket
-- Note: CORS configuration is typically handled at the Supabase project level
-- but we can ensure the bucket settings are correct