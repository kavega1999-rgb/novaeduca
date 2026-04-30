-- Cap existing scores at 100
UPDATE evaluation_attempts SET score = 100 WHERE score > 100;
UPDATE pretest_attempts SET score = 100 WHERE score > 100;

-- Add trigger to enforce score never exceeds 100
CREATE OR REPLACE FUNCTION public.cap_score_at_100()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.score IS NOT NULL AND NEW.score > 100 THEN
    NEW.score := 100;
  END IF;
  IF NEW.score IS NOT NULL AND NEW.score < 0 THEN
    NEW.score := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cap_evaluation_attempt_score ON evaluation_attempts;
CREATE TRIGGER cap_evaluation_attempt_score
  BEFORE INSERT OR UPDATE ON evaluation_attempts
  FOR EACH ROW EXECUTE FUNCTION public.cap_score_at_100();

DROP TRIGGER IF EXISTS cap_pretest_attempt_score ON pretest_attempts;
CREATE TRIGGER cap_pretest_attempt_score
  BEFORE INSERT OR UPDATE ON pretest_attempts
  FOR EACH ROW EXECUTE FUNCTION public.cap_score_at_100();