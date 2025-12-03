-- Create a public bucket specifically for certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policy to allow authenticated users to read certificates
CREATE POLICY "Anyone can view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates');

-- Create policy to allow service role to upload certificates
CREATE POLICY "Service role can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates');