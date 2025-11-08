-- Add total_pages field to trainings table
ALTER TABLE trainings 
ADD COLUMN total_pages integer DEFAULT 10;

-- Add comment
COMMENT ON COLUMN trainings.total_pages IS 'Número total de páginas del contenido PDF de la capacitación';