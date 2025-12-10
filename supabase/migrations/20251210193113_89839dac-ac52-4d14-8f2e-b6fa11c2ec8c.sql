-- Add requires_pretest column to evaluations table
ALTER TABLE public.evaluations 
ADD COLUMN requires_pretest boolean NOT NULL DEFAULT false;