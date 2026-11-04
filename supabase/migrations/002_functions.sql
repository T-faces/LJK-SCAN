-- ============================================================
-- 002 — Fungsi bantu, penilaian, dan RPC
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

create or replace function public.my_teacher_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.teachers where user_id = auth.uid() limit 1
$$;

create or replace function public.can_access_exam(p_exam uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.is_active_user() and exists (
      select 1 from public.exams e where e.id = p_exam and e.teacher_id is not null and e.teacher_id = public.my_teacher_id()
    )
  )
$$;

revoke all on function public.is_admin(), public.is_active_user(), public.my_teacher_id(), public.can_access_exam(uuid) from public, anon;
grant execute on function public.is_admin(), public.is_active_user(), public.my_teacher_id(), public.can_access_exam(uuid) to authenticated;

-- Hitung benar/salah/kosong. Kunci '-' = soal dibatalkan (dianggap benar).
create or replace function public.compute_score(
  p_answers text, p_key text,
  out v_correct int, out v_wrong int, out v_blank int)
language plpgsql immutable as $$
declare i int; a text; k text;
begin
  v_correct := 0; v_wrong := 0; v_blank := 0;
  for i in 1..length(p_key) loop
    a := substr(p_answers, i, 1);
    k := substr(p_key, i, 1);
    if k = '-' then v_correct := v_correct + 1;
    elsif a = '-' then v_blank := v_blank + 1;
    elsif a = k then v_correct := v_correct + 1;
    else v_wrong := v_wrong + 1;  -- salah atau ganda
    end if;
  end loop;
end $$;

-- Buat LJK untuk seluruh siswa aktif di kelas ujian. Mengembalikan jumlah baris baru.
create or replace function public.generate_sheets(p_exam_id uuid, p_alternate boolean default false)
returns int language plpgsql set search_path = public as $$
declare v_class uuid; v_pakets text[]; n int;
begin
  if not public.can_access_exam(p_exam_id) then
    raise exception 'Tidak berwenang untuk ujian ini';
  end if;
  select class_id, pakets into v_class, v_pakets from public.exams where id = p_exam_id;
  insert into public.ljk_sheets (exam_id, student_id, paket)
  select p_exam_id, s.id,
    case when p_alternate and array_length(v_pakets, 1) > 1
      then v_pakets[1 + ((row_number() over (order by s.full_name) - 1)::int % array_length(v_pakets, 1))]
      else v_pakets[1] end
  from public.students s
  where s.class_id = v_class and s.is_active
  on conflict (exam_id, student_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Simpan kunci jawaban satu paket, lalu nilai ulang LJK paket itu yang sudah discan.
create or replace function public.save_answer_key(p_exam uuid, p_paket text, p_answers text)
returns int language plpgsql set search_path = public as $$
declare ex public.exams; r record; sc record; n int := 0;
begin
  if not public.can_access_exam(p_exam) then raise exception 'Tidak berwenang untuk ujian ini'; end if;
  select * into ex from public.exams where id = p_exam;
  if not found then raise exception 'Ujian tidak ditemukan'; end if;
  if not (p_paket = any (ex.pakets)) then raise exception 'Paket % tidak ada pada ujian ini', p_paket; end if;
  if length(p_answers) <> ex.question_count then
    raise exception 'Kunci harus % karakter (diterima %)', ex.question_count, length(p_answers);
  end if;
  if p_answers !~ '^[A-E-]+$' then raise exception 'Kunci hanya boleh huruf A–E atau "-"'; end if;
  if ex.option_count = 4 and p_answers ~ 'E' then raise exception 'Ujian ini hanya memiliki opsi A–D'; end if;

  insert into public.answer_keys (exam_id, paket, answers) values (p_exam, p_paket, p_answers)
  on conflict (exam_id, paket) do update set answers = excluded.answers;

  for r in select id, answers from public.ljk_sheets where exam_id = p_exam and paket = p_paket and status = 'discan' loop
    select * into sc from public.compute_score(r.answers, p_answers);
    update public.ljk_sheets set correct_count = sc.v_correct, wrong_count = sc.v_wrong, blank_count = sc.v_blank,
      score = round(sc.v_correct::numeric / ex.question_count * 100, 2) where id = r.id;
    n := n + 1;
  end loop;
  return n;  -- jumlah LJK yang dinilai ulang
end $$;

-- Simpan hasil scan + nilai. p_answers: 1 karakter per soal (A–E, '-', '*').
create or replace function public.save_scan(p_sheet_id uuid, p_answers text)
returns public.ljk_sheets language plpgsql set search_path = public as $$
declare sh public.ljk_sheets; ex public.exams; v_key text; sc record;
begin
  select * into sh from public.ljk_sheets where id = p_sheet_id;
  if not found then raise exception 'LJK tidak ditemukan atau Anda tidak punya akses'; end if;
  select * into ex from public.exams where id = sh.exam_id;
  if length(p_answers) <> ex.question_count then
    raise exception 'Jumlah jawaban (%) tidak sama dengan jumlah soal (%)', length(p_answers), ex.question_count;
  end if;
  if p_answers !~ '^[A-E*-]+$' then raise exception 'Format jawaban tidak valid'; end if;
  select answers into v_key from public.answer_keys where exam_id = sh.exam_id and paket = sh.paket;
  if v_key is null then raise exception 'Kunci jawaban paket % belum diatur', sh.paket; end if;
  select * into sc from public.compute_score(p_answers, v_key);

  update public.ljk_sheets set
    answers = p_answers, status = 'discan', scanned_at = now(), scanned_by = auth.uid(),
    correct_count = sc.v_correct, wrong_count = sc.v_wrong, blank_count = sc.v_blank,
    score = round(sc.v_correct::numeric / ex.question_count * 100, 2)
  where id = p_sheet_id
  returning * into sh;
  if not found then raise exception 'Tidak berhak mengubah LJK ini'; end if;
  return sh;
end $$;

-- Hapus hasil scan (kembali ke "belum")
create or replace function public.reset_scan(p_sheet_id uuid)
returns void language plpgsql set search_path = public as $$
begin
  update public.ljk_sheets set status = 'belum', answers = null, correct_count = null, wrong_count = null,
    blank_count = null, score = null, scanned_at = null, scanned_by = null where id = p_sheet_id;
  if not found then raise exception 'LJK tidak ditemukan atau tidak ada akses'; end if;
end $$;

-- Statistik nilai (RLS tetap berlaku: guru hanya melihat ujiannya)
create or replace function public.score_stats(p_exam_id uuid default null)
returns table (avg_score numeric, max_score numeric, min_score numeric, n int,
               b_a int, b_b int, b_c int, b_d int)
language sql stable set search_path = public as $$
  select round(avg(score), 1), max(score), min(score), count(*)::int,
    count(*) filter (where score >= 85)::int,
    count(*) filter (where score >= 70 and score < 85)::int,
    count(*) filter (where score >= 55 and score < 70)::int,
    count(*) filter (where score < 55)::int
  from public.ljk_sheets
  where status = 'discan' and (p_exam_id is null or exam_id = p_exam_id)
$$;

grant execute on function public.generate_sheets(uuid, boolean), public.save_answer_key(uuid, text, text),
  public.save_scan(uuid, text), public.reset_scan(uuid), public.score_stats(uuid), public.compute_score(text, text)
  to authenticated;
revoke execute on function public.generate_sheets(uuid, boolean), public.save_answer_key(uuid, text, text),
  public.save_scan(uuid, text), public.reset_scan(uuid), public.score_stats(uuid) from anon, public;

-- Ringkasan jumlah LJK per ujian (untuk daftar jadwal)
create or replace function public.exam_sheet_counts()
returns table (exam_id uuid, total int, scanned int)
language sql stable set search_path = public as $$
  select exam_id, count(*)::int, count(*) filter (where status = 'discan')::int
  from public.ljk_sheets group by exam_id
$$;
grant execute on function public.exam_sheet_counts() to authenticated;
revoke execute on function public.exam_sheet_counts() from anon, public;
