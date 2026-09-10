CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS cr_admin_all ON public.contributor_requests;
CREATE POLICY cr_admin_all ON public.contributor_requests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS de_admin_all ON public.dataset_entries;
CREATE POLICY de_admin_all ON public.dataset_entries FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS de_insert_contributor ON public.dataset_entries;
CREATE POLICY de_insert_contributor ON public.dataset_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND private.has_role(auth.uid(), 'contributor'));

DROP POLICY IF EXISTS de_select_approved ON public.dataset_entries;
CREATE POLICY de_select_approved ON public.dataset_entries FOR SELECT TO authenticated
  USING (status = 'approved' AND private.has_role(auth.uid(), 'contributor'));

DROP POLICY IF EXISTS roles_admin_all ON public.user_roles;
CREATE POLICY roles_admin_all ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS dataset_upload_contributor ON storage.objects;
CREATE POLICY dataset_upload_contributor ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dataset-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND private.has_role(auth.uid(), 'contributor')
  );

DROP POLICY IF EXISTS dataset_read_own ON storage.objects;
CREATE POLICY dataset_read_own ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dataset-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR private.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS dataset_delete_admin ON storage.objects;
CREATE POLICY dataset_delete_admin ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'dataset-images'
    AND (private.has_role(auth.uid(), 'admin') OR (storage.foldername(name))[1] = auth.uid()::text)
  );

DROP POLICY IF EXISTS dataset_update_own ON storage.objects;
CREATE POLICY dataset_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dataset-images'
    AND (
      ((storage.foldername(name))[1] = auth.uid()::text AND private.has_role(auth.uid(), 'contributor'))
      OR private.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'dataset-images'
    AND (
      ((storage.foldername(name))[1] = auth.uid()::text AND private.has_role(auth.uid(), 'contributor'))
      OR private.has_role(auth.uid(), 'admin')
    )
  );

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);