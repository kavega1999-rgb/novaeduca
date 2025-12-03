-- Add year column to trainings table
ALTER TABLE public.trainings 
ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;

-- Create index for better performance when filtering by year
CREATE INDEX idx_trainings_year ON public.trainings(year);