-- Add field to track if content has been fully viewed
ALTER TABLE user_progress 
ADD COLUMN content_viewed_completely boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN user_progress.content_viewed_completely IS 'Indica si el usuario ha visto todo el contenido de la capacitación';