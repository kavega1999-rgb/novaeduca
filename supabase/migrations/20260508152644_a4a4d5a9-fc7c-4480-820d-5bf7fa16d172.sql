
-- Add authorized employees (whitelist for registration)
INSERT INTO public.authorized_employees (full_name, document_number) VALUES
  ('Benavidez Escobar Nany Esther', '1042973160'),
  ('Carrillo Manjarez Sindy Johana', '1043872112'),
  ('Eljach Acosta Karina Esther', '30844192'),
  ('Galindo Gomez Oscar', '72261324'),
  ('Galavis Figueroa Kelly Johana', '22648264'),
  ('Garces Alvarado Estefany', '1050456419'),
  ('Martinez Aguas Yenis Paola', '1052955946'),
  ('Mercado Orozco Lilia Margarita', '1042970988'),
  ('Nuñez Urdaneta Ederlin Maria', '1045762499'),
  ('Sierra Camargo Jose David', '1044424189'),
  ('Valle Diaz Vanessa Catherine', '40932944')
ON CONFLICT DO NOTHING;

-- Unify duplicate trainings "Uso seguro de medicamentos"
-- Keep A = adcced11-cef1-4eaa-bda5-3ef8f99e0827 (older, more data)
-- Merge B = eac40575-7a8c-498f-8c24-56a2f3228b2f into A

DO $$
DECLARE
  a_id uuid := 'adcced11-cef1-4eaa-bda5-3ef8f99e0827';
  b_id uuid := 'eac40575-7a8c-498f-8c24-56a2f3228b2f';
BEGIN
  -- user_progress: delete B rows that conflict with A, then re-point remaining
  DELETE FROM user_progress WHERE training_id = b_id
    AND user_id IN (SELECT user_id FROM user_progress WHERE training_id = a_id);
  UPDATE user_progress SET training_id = a_id WHERE training_id = b_id;

  -- training_assignments
  DELETE FROM training_assignments WHERE training_id = b_id
    AND user_id IN (SELECT user_id FROM training_assignments WHERE training_id = a_id);
  UPDATE training_assignments SET training_id = a_id WHERE training_id = b_id;

  -- training_target_areas
  DELETE FROM training_target_areas WHERE training_id = b_id
    AND target_area IN (SELECT target_area FROM training_target_areas WHERE training_id = a_id);
  UPDATE training_target_areas SET training_id = a_id WHERE training_id = b_id;

  -- certificates, adherence_reports, pretest_attempts: no unique constraint, just re-point
  UPDATE certificates SET training_id = a_id WHERE training_id = b_id;
  UPDATE adherence_reports SET training_id = a_id WHERE training_id = b_id;
  UPDATE pretest_attempts SET training_id = a_id WHERE training_id = b_id;

  -- evaluations: re-point to A so attempts/questions stay valid
  UPDATE evaluations SET training_id = a_id WHERE training_id = b_id;

  -- Finally remove B
  DELETE FROM trainings WHERE id = b_id;
END $$;
