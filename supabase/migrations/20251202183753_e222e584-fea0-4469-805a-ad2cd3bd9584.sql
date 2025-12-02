-- Drop partially created types if they exist
DROP TYPE IF EXISTS public.visibility_target CASCADE;
DROP TYPE IF EXISTS public.document_category CASCADE;
DROP TABLE IF EXISTS public.institutional_documents CASCADE;

-- Create enum for document categories
CREATE TYPE public.document_category AS ENUM ('Norma', 'Circular', 'Resolución', 'Manual', 'Otro');

-- Create enum for visibility targets
CREATE TYPE public.visibility_target AS ENUM ('Administrativos', 'Médicos', 'Operativos', 'Todos');

-- Create institutional documents table
CREATE TABLE public.institutional_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category document_category NOT NULL,
  published_at DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT,
  file_url TEXT NOT NULL,
  visible_to visibility_target[] NOT NULL DEFAULT '{Todos}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.institutional_documents ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all documents"
ON public.institutional_documents
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can view documents they have access to (using user_area enum values: medicos, asistencial, administrativos)
CREATE POLICY "Users can view permitted documents"
ON public.institutional_documents
FOR SELECT
USING (
  'Todos' = ANY(visible_to)
  OR (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        (p.area = 'administrativos'::user_area AND 'Administrativos' = ANY(visible_to))
        OR (p.area = 'medicos'::user_area AND 'Médicos' = ANY(visible_to))
        OR (p.area = 'asistencial'::user_area AND 'Operativos' = ANY(visible_to))
      )
    )
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_institutional_documents_updated_at
BEFORE UPDATE ON public.institutional_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('institutional-documents', 'institutional-documents', true);

-- Storage policies
CREATE POLICY "Anyone can view institutional documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'institutional-documents');

CREATE POLICY "Admins can upload institutional documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'institutional-documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update institutional documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'institutional-documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete institutional documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'institutional-documents' AND has_role(auth.uid(), 'admin'));