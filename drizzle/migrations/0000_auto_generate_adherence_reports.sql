CREATE OR REPLACE FUNCTION public.adherence_score_category(_score numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _score >= 90 THEN 'Excelente'
              WHEN _score >= 80 THEN 'Bueno'
              WHEN _score >= 70 THEN 'Aceptable'
              ELSE 'Inaceptable' END
$$;

CREATE OR REPLACE FUNCTION public.refresh_adherence_report(_postest_attempt_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid; v_training uuid; v_post numeric; v_status text;
  v_pre_id uuid; v_pre numeric; v_title text;
  v_pre_cat text; v_post_cat text; v_imp numeric;
  v_conclusion text; v_strategies text[]; v_existing uuid;
BEGIN
  SELECT ea.user_id, e.training_id, COALESCE(ea.score, 0), ea.status
    INTO v_user, v_training, v_post, v_status
  FROM evaluation_attempts ea JOIN evaluations e ON e.id = ea.evaluation_id
  WHERE ea.id = _postest_attempt_id;
  IF v_user IS NULL OR v_status <> 'completed' THEN RETURN; END IF;

  SELECT id, COALESCE(score, 0) INTO v_pre_id, v_pre
  FROM pretest_attempts
  WHERE training_id = v_training AND user_id = v_user AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST LIMIT 1;
  v_pre := COALESCE(v_pre, 0);

  SELECT COALESCE(title, 'Capacitación') INTO v_title FROM trainings WHERE id = v_training;
  v_title := COALESCE(v_title, 'Capacitación');
  v_pre_cat := adherence_score_category(v_pre);
  v_post_cat := adherence_score_category(v_post);
  v_imp := v_post - v_pre;

  IF v_imp > 20 THEN
    v_conclusion := format('El participante demostró una mejora sobresaliente de %s puntos porcentuales en la capacitación "%s". Pasó de un nivel %s (%s%%) a %s (%s%%), evidenciando una excelente asimilación del contenido y compromiso con el aprendizaje.', round(v_imp,1), v_title, v_pre_cat, round(v_pre,1), v_post_cat, round(v_post,1));
  ELSIF v_imp > 10 THEN
    v_conclusion := format('El participante mostró una mejora significativa de %s puntos porcentuales. El nivel inicial %s (%s%%) evolucionó a %s (%s%%) tras la capacitación "%s", lo que indica una buena comprensión del material.', round(v_imp,1), v_pre_cat, round(v_pre,1), v_post_cat, round(v_post,1), v_title);
  ELSIF v_imp > 0 THEN
    v_conclusion := format('Se observa una mejora moderada de %s puntos porcentuales en la capacitación "%s". El participante pasó de %s%% (%s) a %s%% (%s). Se recomienda reforzar algunos conceptos.', round(v_imp,1), v_title, round(v_pre,1), v_pre_cat, round(v_post,1), v_post_cat);
  ELSIF v_imp = 0 THEN
    v_conclusion := format('El participante mantuvo el mismo nivel de conocimiento antes y después de la capacitación "%s" (%s%% - %s). Se sugiere revisar la metodología de enseñanza o realizar un seguimiento personalizado.', v_title, round(v_post,1), v_post_cat);
  ELSE
    v_conclusion := format('Se detectó una disminución de %s puntos porcentuales entre el pretest (%s%%) y el postest (%s%%) en "%s". Esto puede indicar fatiga, falta de concentración o necesidad de refuerzo en los conceptos clave.', round(abs(v_imp),1), round(v_pre,1), round(v_post,1), v_title);
  END IF;

  IF v_post_cat = 'Excelente' THEN
    v_strategies := ARRAY['• Mantener el excelente nivel alcanzado mediante capacitaciones de actualización periódicas.','• Considerar al participante como mentor para apoyar a compañeros con dificultades.','• Proporcionar material avanzado para continuar su desarrollo profesional.'];
  ELSIF v_post_cat = 'Bueno' THEN
    v_strategies := ARRAY['• Reforzar los temas donde se presentaron errores mediante ejercicios prácticos.','• Programar una sesión de repaso corta en las próximas 2 semanas.','• Proporcionar material complementario de lectura.'];
  ELSIF v_post_cat = 'Aceptable' THEN
    v_strategies := ARRAY['• Realizar una tutoría personalizada enfocada en los conceptos principales.','• Implementar evaluaciones de seguimiento semanales.','• Considerar métodos de aprendizaje alternativos (videos, talleres prácticos).','• Verificar comprensión mediante casos prácticos y simulaciones.'];
  ELSE
    v_strategies := ARRAY['• Programar una recapacitación completa con metodología diferente.','• Asignar un tutor o compañero de apoyo para acompañamiento.','• Identificar posibles barreras de aprendizaje (tiempo, recursos, motivación).','• Dividir el contenido en módulos más pequeños y manejables.','• Realizar seguimiento semanal del progreso.'];
  END IF;
  IF v_imp < 0 THEN
    v_strategies := v_strategies || ARRAY['• Investigar factores externos que pudieron afectar el desempeño (estrés, carga laboral).','• Revisar si el formato de la evaluación es adecuado para el participante.'];
  END IF;

  SELECT id INTO v_existing FROM adherence_reports
  WHERE postest_attempt_id = _postest_attempt_id LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE adherence_reports SET
      pretest_attempt_id = v_pre_id, pretest_score = v_pre, postest_score = v_post,
      pretest_category = v_pre_cat, postest_category = v_post_cat,
      improvement_percentage = v_imp, conclusion = v_conclusion,
      strategies = array_to_string(v_strategies, E'\n')
    WHERE id = v_existing;
  ELSE
    INSERT INTO adherence_reports (user_id, training_id, pretest_attempt_id, postest_attempt_id,
      pretest_score, postest_score, pretest_category, postest_category,
      improvement_percentage, conclusion, strategies)
    VALUES (v_user, v_training, v_pre_id, _postest_attempt_id, v_pre, v_post, v_pre_cat, v_post_cat,
      v_imp, v_conclusion, array_to_string(v_strategies, E'\n'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_evaluation_attempt_adherence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    PERFORM refresh_adherence_report(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pretest_attempt_adherence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'completed' THEN
    FOR r IN SELECT postest_attempt_id FROM adherence_reports
             WHERE user_id = NEW.user_id AND training_id = NEW.training_id AND postest_attempt_id IS NOT NULL
    LOOP
      PERFORM refresh_adherence_report(r.postest_attempt_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluation_attempt_adherence_report ON public.evaluation_attempts;
CREATE TRIGGER evaluation_attempt_adherence_report
AFTER INSERT OR UPDATE OF status, score, completed_at ON public.evaluation_attempts
FOR EACH ROW EXECUTE FUNCTION public.trg_evaluation_attempt_adherence();

DROP TRIGGER IF EXISTS pretest_attempt_adherence_report ON public.pretest_attempts;
CREATE TRIGGER pretest_attempt_adherence_report
AFTER INSERT OR UPDATE OF status, score, completed_at ON public.pretest_attempts
FOR EACH ROW EXECUTE FUNCTION public.trg_pretest_attempt_adherence();

REVOKE EXECUTE ON FUNCTION public.refresh_adherence_report(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_evaluation_attempt_adherence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pretest_attempt_adherence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adherence_score_category(numeric) FROM PUBLIC, anon;

-- Backfill: latest completed postest for every user/training without any report
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (ea.user_id, e.training_id) ea.id
    FROM evaluation_attempts ea JOIN evaluations e ON e.id = ea.evaluation_id
    WHERE ea.status = 'completed'
      AND NOT EXISTS (SELECT 1 FROM adherence_reports ar WHERE ar.user_id = ea.user_id AND ar.training_id = e.training_id)
    ORDER BY ea.user_id, e.training_id, ea.completed_at DESC NULLS LAST
  LOOP
    PERFORM public.refresh_adherence_report(r.id);
  END LOOP;
END $$;