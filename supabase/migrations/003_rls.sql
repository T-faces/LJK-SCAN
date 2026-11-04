-- ============================================================
-- 003 — Row Level Security
-- Admin: akses penuh. Guru: hanya ujian yang menjadi tanggung jawabnya.
-- anon: tidak punya akses apa pun.
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.school_settings enable row level security;
alter table public.teachers        enable row level security;
alter table public.classes         enable row level security;
alter table public.students        enable row level security;
alter table public.subjects        enable row level security;
alter table public.exams           enable row level security;
alter table public.answer_keys     enable row level security;
alter table public.ljk_sheets      enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Data referensi: dibaca semua pengguna aktif, diubah admin
do $$
declare t text;
begin
  foreach t in array array['school_settings','teachers','classes','students','subjects']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_active_user())', t);
    execute format('drop policy if exists %1$s_admin_write on public.%1$s', t);
    execute format('create policy %1$s_admin_write on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- exams
drop policy if exists exams_select on public.exams;
create policy exams_select on public.exams for select to authenticated
  using (public.is_admin() or (public.is_active_user() and teacher_id is not null and teacher_id = public.my_teacher_id()));
drop policy if exists exams_insert on public.exams;
create policy exams_insert on public.exams for insert to authenticated
  with check (public.is_admin() or (public.is_active_user() and teacher_id = public.my_teacher_id()));
drop policy if exists exams_update on public.exams;
create policy exams_update on public.exams for update to authenticated
  using (public.can_access_exam(id))
  with check (public.is_admin() or teacher_id = public.my_teacher_id());
drop policy if exists exams_delete on public.exams;
create policy exams_delete on public.exams for delete to authenticated
  using (public.can_access_exam(id));

-- answer_keys & ljk_sheets mengikuti hak akses ujian
drop policy if exists answer_keys_all on public.answer_keys;
create policy answer_keys_all on public.answer_keys for all to authenticated
  using (public.can_access_exam(exam_id)) with check (public.can_access_exam(exam_id));
drop policy if exists ljk_sheets_all on public.ljk_sheets;
create policy ljk_sheets_all on public.ljk_sheets for all to authenticated
  using (public.can_access_exam(exam_id)) with check (public.can_access_exam(exam_id));

-- Tabel hanya boleh diakses role authenticated (bukan anon)
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
