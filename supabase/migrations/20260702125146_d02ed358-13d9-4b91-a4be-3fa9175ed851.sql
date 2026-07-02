
-- ENUMS
CREATE TYPE public.survey_status AS ENUM ('draft','published','closed');
CREATE TYPE public.survey_question_type AS ENUM (
  'short_text','long_text','number','date','time','email','phone',
  'dropdown','single_choice','multi_choice','boolean',
  'rating','scale','file','signature','section_info'
);
CREATE TYPE public.survey_response_status AS ENUM ('pending','in_progress','submitted');
CREATE TYPE public.survey_assignment_type AS ENUM ('user','area','position','site','all');
CREATE TYPE public.survey_permission AS ENUM (
  'create','edit','delete','publish','close',
  'view_responses','export','view_dashboard',
  'manage_templates','manage_own_area','manage_all'
);

-- =========================================================
-- TABLES (created first, RLS enabled but policies added later)
-- =========================================================

CREATE TABLE public.survey_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.survey_categories TO authenticated;
GRANT ALL ON public.survey_categories TO service_role;
ALTER TABLE public.survey_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.survey_permission NOT NULL,
  scope_area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission, scope_area_id)
);
GRANT SELECT ON public.survey_user_permissions TO authenticated;
GRANT ALL ON public.survey_user_permissions TO service_role;
ALTER TABLE public.survey_user_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES public.survey_categories(id) ON DELETE SET NULL,
  owner_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  status public.survey_status NOT NULL DEFAULT 'draft',
  is_template boolean NOT NULL DEFAULT false,
  allow_multiple_responses boolean NOT NULL DEFAULT false,
  autosave_enabled boolean NOT NULL DEFAULT true,
  opens_at timestamptz,
  closes_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_sections TO authenticated;
GRANT ALL ON public.survey_sections TO service_role;
ALTER TABLE public.survey_sections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.survey_sections(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  help_text text,
  question_type public.survey_question_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  is_readonly boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  validations jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_value text,
  visibility_condition jsonb,
  autofill_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_questions TO authenticated;
GRANT ALL ON public.survey_questions TO service_role;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_question_options TO authenticated;
GRANT ALL ON public.survey_question_options TO service_role;
ALTER TABLE public.survey_question_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  assignment_type public.survey_assignment_type NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  target_value text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_assignments TO authenticated;
GRANT ALL ON public.survey_assignments TO service_role;
ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.survey_response_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  submitted_at timestamptz,
  last_saved_at timestamptz,
  duration_seconds integer,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_survey_responses_active
  ON public.survey_responses(survey_id, user_id)
  WHERE status <> 'submitted';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_date date,
  value_boolean boolean,
  value_json jsonb,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(response_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_answers TO authenticated;
GRANT ALL ON public.survey_answers TO service_role;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.surveys(id) ON DELETE SET NULL,
  response_id uuid REFERENCES public.survey_responses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  payload jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.survey_audit_log TO authenticated;
GRANT ALL ON public.survey_audit_log TO service_role;
ALTER TABLE public.survey_audit_log ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
CREATE TRIGGER trg_survey_categories_updated BEFORE UPDATE ON public.survey_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_surveys_updated BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_survey_sections_updated BEFORE UPDATE ON public.survey_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_survey_questions_updated BEFORE UPDATE ON public.survey_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_survey_responses_updated BEFORE UPDATE ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_survey_answers_updated BEFORE UPDATE ON public.survey_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- HELPER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_survey_permission(_user_id uuid, _permission public.survey_permission, _area_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.has_role(_user_id,'admin')
    OR EXISTS (
      SELECT 1 FROM public.survey_user_permissions
      WHERE user_id = _user_id
        AND (permission = _permission OR permission = 'manage_all')
        AND (scope_area_id IS NULL OR scope_area_id = _area_id OR _area_id IS NULL)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_survey(_user_id uuid, _survey_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.has_role(_user_id,'admin')
    OR EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = _survey_id
        AND (
          s.created_by = _user_id
          OR public.has_survey_permission(_user_id,'manage_all', NULL)
          OR public.has_survey_permission(_user_id,'manage_own_area', s.owner_area_id)
          OR public.has_survey_permission(_user_id,'edit', s.owner_area_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_survey_assigned_to(_user_id uuid, _survey_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.survey_assignments sa
    LEFT JOIN public.profiles p ON p.id = _user_id
    WHERE sa.survey_id = _survey_id
      AND (
        sa.assignment_type = 'all'
        OR (sa.assignment_type = 'user' AND sa.target_user_id = _user_id)
        OR (sa.assignment_type = 'area' AND sa.target_area_id = p.leader_area_id)
        OR (sa.assignment_type = 'position' AND lower(sa.target_value) = lower(p.position))
      )
  );
$$;

-- =========================================================
-- POLICIES
-- =========================================================

-- categories
CREATE POLICY "Auth read categories" ON public.survey_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.survey_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user permissions
CREATE POLICY "Users read own permissions" ON public.survey_user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage permissions" ON public.survey_user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- surveys
CREATE POLICY "Read manageable or assigned surveys" ON public.surveys FOR SELECT TO authenticated
  USING (
    public.can_manage_survey(auth.uid(), id)
    OR (status = 'published' AND public.is_survey_assigned_to(auth.uid(), id))
  );
CREATE POLICY "Creators insert surveys" ON public.surveys FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_survey_permission(auth.uid(),'create', owner_area_id)
    )
  );
CREATE POLICY "Managers update surveys" ON public.surveys FOR UPDATE TO authenticated
  USING (public.can_manage_survey(auth.uid(), id))
  WITH CHECK (public.can_manage_survey(auth.uid(), id));
CREATE POLICY "Managers delete surveys" ON public.surveys FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_survey_permission(auth.uid(),'delete', owner_area_id)
  );

-- sections
CREATE POLICY "Read sections accessible" ON public.survey_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND (
    public.can_manage_survey(auth.uid(), s.id)
    OR (s.status='published' AND public.is_survey_assigned_to(auth.uid(), s.id))
  )));
CREATE POLICY "Managers write sections" ON public.survey_sections FOR ALL TO authenticated
  USING (public.can_manage_survey(auth.uid(), survey_id))
  WITH CHECK (public.can_manage_survey(auth.uid(), survey_id));

-- questions
CREATE POLICY "Read questions accessible" ON public.survey_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND (
    public.can_manage_survey(auth.uid(), s.id)
    OR (s.status='published' AND public.is_survey_assigned_to(auth.uid(), s.id))
  )));
CREATE POLICY "Managers write questions" ON public.survey_questions FOR ALL TO authenticated
  USING (public.can_manage_survey(auth.uid(), survey_id))
  WITH CHECK (public.can_manage_survey(auth.uid(), survey_id));

-- options
CREATE POLICY "Read options accessible" ON public.survey_question_options FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.survey_questions q
    JOIN public.surveys s ON s.id = q.survey_id
    WHERE q.id = question_id AND (
      public.can_manage_survey(auth.uid(), s.id)
      OR (s.status='published' AND public.is_survey_assigned_to(auth.uid(), s.id))
    )
  ));
CREATE POLICY "Managers write options" ON public.survey_question_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.survey_questions q WHERE q.id=question_id AND public.can_manage_survey(auth.uid(), q.survey_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.survey_questions q WHERE q.id=question_id AND public.can_manage_survey(auth.uid(), q.survey_id)));

-- assignments
CREATE POLICY "Read assignments" ON public.survey_assignments FOR SELECT TO authenticated
  USING (
    public.can_manage_survey(auth.uid(), survey_id)
    OR (assignment_type='user' AND target_user_id = auth.uid())
    OR (assignment_type='all')
  );
CREATE POLICY "Managers write assignments" ON public.survey_assignments FOR ALL TO authenticated
  USING (public.can_manage_survey(auth.uid(), survey_id))
  WITH CHECK (public.can_manage_survey(auth.uid(), survey_id));

-- responses
CREATE POLICY "Read own or manageable responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_survey(auth.uid(), survey_id)
    OR public.has_survey_permission(auth.uid(),'view_responses',(SELECT owner_area_id FROM public.surveys WHERE id=survey_id))
  );
CREATE POLICY "Users insert own response if assigned" ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_survey_assigned_to(auth.uid(), survey_id)
    AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id=survey_id AND s.status='published')
  );
CREATE POLICY "Users update own draft" ON public.survey_responses FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status <> 'submitted')
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins delete responses" ON public.survey_responses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- answers
CREATE POLICY "Read answers accessible" ON public.survey_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.survey_responses r
    WHERE r.id = response_id
      AND (
        r.user_id = auth.uid()
        OR public.can_manage_survey(auth.uid(), r.survey_id)
        OR public.has_survey_permission(auth.uid(),'view_responses',(SELECT owner_area_id FROM public.surveys WHERE id=r.survey_id))
      )
  ));
CREATE POLICY "Owner writes answers while draft" ON public.survey_answers FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.survey_responses r
    WHERE r.id = response_id AND r.user_id = auth.uid() AND r.status <> 'submitted'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.survey_responses r
    WHERE r.id = response_id AND r.user_id = auth.uid() AND r.status <> 'submitted'
  ));

-- audit log
CREATE POLICY "Admins read audit" ON public.survey_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Auth insert audit" ON public.survey_audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =========================================================
-- SEED CATEGORIES
-- =========================================================
INSERT INTO public.survey_categories (name, description, icon, color) VALUES
  ('SST','Seguridad y Salud en el Trabajo','ShieldCheck','#F59E0B'),
  ('Calidad','Gestión de Calidad','Award','#3B82F6'),
  ('Talento Humano','Recursos Humanos','Users','#10B981'),
  ('Seguridad del Paciente','Seguridad del Paciente','HeartPulse','#EF4444')
ON CONFLICT (name) DO NOTHING;
