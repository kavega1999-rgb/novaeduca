-- 1. authorized_employees: quitar lectura pública
DROP POLICY IF EXISTS "Anyone can check if document is authorized" ON public.authorized_employees;

-- 2. adherence_reports: quitar políticas abiertas
DROP POLICY IF EXISTS "Service role can insert adherence reports" ON public.adherence_reports;
DROP POLICY IF EXISTS "Service role can update adherence reports" ON public.adherence_reports;

-- 3. certificates: quitar insert abierto
DROP POLICY IF EXISTS "Service role can insert certificates" ON public.certificates;

-- 4. Storage: certificados
DROP POLICY IF EXISTS "Anyone can view certificates" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload certificates" ON storage.objects;

CREATE POLICY "Owners admins and leaders can view certificates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    position(auth.uid()::text in name) > 0
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'leader')
  )
);

-- 5. Storage: training-materials, quitar listado amplio
DROP POLICY IF EXISTS "Authenticated users can view training materials" ON storage.objects;

-- 6. Storage: institutional-documents, lectura segun visibilidad
DROP POLICY IF EXISTS "Authenticated users can view institutional documents" ON storage.objects;

CREATE POLICY "Users can view permitted institutional documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'institutional-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'leader')
    OR EXISTS (
      SELECT 1
      FROM public.institutional_documents d
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE d.file_url LIKE '%' || storage.objects.name
        AND (
          'Todos'::visibility_target = ANY (d.visible_to)
          OR (p.area = 'administrativos'::user_area AND 'Administrativos'::visibility_target = ANY (d.visible_to))
          OR (p.area = 'medicos'::user_area AND 'Médicos'::visibility_target = ANY (d.visible_to))
          OR (p.area = 'asistencial'::user_area AND 'Operativos'::visibility_target = ANY (d.visible_to))
        )
    )
  )
);

-- 7. Funciones: search_path fijo
CREATE OR REPLACE FUNCTION public.cap_score_at_100()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.score IS NOT NULL AND NEW.score > 100 THEN
    NEW.score := 100;
  END IF;
  IF NEW.score IS NOT NULL AND NEW.score < 0 THEN
    NEW.score := 0;
  END IF;
  RETURN NEW;
END;
$function$;

-- 8. Revocar EXECUTE publico/anon en funciones SECURITY DEFINER y de trigger
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_survey_permission(uuid, survey_permission, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_survey(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_survey_assigned_to(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_leader_of_area(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cap_score_at_100() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_survey_permission(uuid, survey_permission, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_survey(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_survey_assigned_to(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_leader_of_area(uuid, uuid) TO authenticated, service_role;