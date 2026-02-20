
-- Tabla de empleados autorizados para registro
CREATE TABLE public.authorized_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.authorized_employees ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden gestionar la tabla
CREATE POLICY "Admins can manage authorized employees"
ON public.authorized_employees
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Cualquier persona puede verificar si su documento está autorizado (para el registro)
CREATE POLICY "Anyone can check if document is authorized"
ON public.authorized_employees
FOR SELECT
USING (true);

-- Agregar columnas de identificación a profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS id_type text,
ADD COLUMN IF NOT EXISTS id_number text;
