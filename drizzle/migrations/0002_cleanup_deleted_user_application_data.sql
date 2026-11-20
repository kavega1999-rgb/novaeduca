CREATE OR REPLACE FUNCTION public.cleanup_deleted_user_application_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.adherence_reports WHERE user_id = OLD.id OR postest_attempt_id IN (SELECT id FROM public.evaluation_attempts WHERE user_id = OLD.id) OR pretest_attempt_id IN (SELECT id FROM public.pretest_attempts WHERE user_id = OLD.id);
  DELETE FROM public.pretest_attempts WHERE user_id = OLD.id;
  DELETE FROM public.leader_areas WHERE user_id = OLD.id;
  UPDATE public.leader_areas SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.institutional_documents SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.training_assignments SET assigned_by = NULL WHERE assigned_by = OLD.id;
  UPDATE public.trainings SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.trainings SET finished_by = NULL WHERE finished_by = OLD.id;
  UPDATE public.surveys SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.survey_assignments SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.survey_user_permissions SET granted_by = NULL WHERE granted_by = OLD.id;
  UPDATE public.survey_audit_log SET user_id = NULL WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_deleted_user_application_data() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cleanup_deleted_user_application_data BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_user_application_data();