GRANT SELECT, INSERT ON public.authorized_employees TO authenticated;
GRANT ALL ON public.authorized_employees TO service_role;
ALTER TABLE public.authorized_employees ENABLE ROW LEVEL SECURITY;
ALTER POLICY "Admins can manage authorized employees" ON public.authorized_employees TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::public.app_role)
);