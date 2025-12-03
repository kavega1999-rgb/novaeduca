-- Make training-materials bucket public
UPDATE storage.buckets SET public = true WHERE id = 'training-materials';