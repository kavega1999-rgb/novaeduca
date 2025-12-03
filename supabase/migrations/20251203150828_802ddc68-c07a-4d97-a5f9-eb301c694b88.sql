-- Make training-materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'training-materials';

-- Make institutional-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'institutional-documents';