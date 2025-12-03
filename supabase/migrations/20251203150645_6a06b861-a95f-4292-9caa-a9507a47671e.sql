-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Anyone can view training materials" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view institutional documents" ON storage.objects;

-- Create proper SELECT policies for training-materials
CREATE POLICY "Authenticated users can view training materials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-materials' AND auth.uid() IS NOT NULL
);

-- Create proper SELECT policies for institutional-documents
CREATE POLICY "Authenticated users can view institutional documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'institutional-documents' AND auth.uid() IS NOT NULL
);