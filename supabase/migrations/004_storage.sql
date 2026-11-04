-- ============================================================
-- 004 — Storage: bucket logo sekolah (publik baca, admin tulis)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school', 'school', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "school_logo_read" on storage.objects;
create policy "school_logo_read" on storage.objects for select to authenticated
  using (bucket_id = 'school');
drop policy if exists "school_logo_admin_insert" on storage.objects;
create policy "school_logo_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'school' and public.is_admin());
drop policy if exists "school_logo_admin_update" on storage.objects;
create policy "school_logo_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'school' and public.is_admin());
drop policy if exists "school_logo_admin_delete" on storage.objects;
create policy "school_logo_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'school' and public.is_admin());
