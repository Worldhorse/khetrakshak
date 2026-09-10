
CREATE POLICY "dataset_upload_contributor" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dataset-images' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_role(auth.uid(), 'contributor'));

CREATE POLICY "dataset_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dataset-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "dataset_delete_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dataset-images' AND (public.has_role(auth.uid(), 'admin') OR (storage.foldername(name))[1] = auth.uid()::text));
