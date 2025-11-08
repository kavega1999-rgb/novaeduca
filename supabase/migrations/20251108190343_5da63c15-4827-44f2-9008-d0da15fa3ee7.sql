-- Create enum for user areas
CREATE TYPE public.user_area AS ENUM ('medicos', 'asistencial', 'administrativos');

-- Update profiles table to use the enum
ALTER TABLE public.profiles
ALTER COLUMN area TYPE user_area USING area::user_area;

-- Add comment
COMMENT ON COLUMN public.profiles.area IS 'Área a la que pertenece el usuario';

-- Create training_target_areas table for many-to-many relationship
CREATE TABLE public.training_target_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  target_area user_area NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(training_id, target_area)
);

-- Add visible_to_all flag to trainings
ALTER TABLE public.trainings
ADD COLUMN visible_to_all BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.trainings.visible_to_all IS 'Si es true, la capacitación es visible para todos los usuarios independientemente de su área';

-- Enable RLS on training_target_areas
ALTER TABLE public.training_target_areas ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_target_areas
CREATE POLICY "Admins and leaders can manage target areas"
ON public.training_target_areas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'leader'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'leader'::app_role));

CREATE POLICY "Users can view target areas for active trainings"
ON public.training_target_areas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trainings
    WHERE trainings.id = training_target_areas.training_id
    AND trainings.status = 'active'
  )
);

-- Update existing trainings to be visible to all
UPDATE public.trainings SET visible_to_all = true WHERE visible_to_all IS NULL;