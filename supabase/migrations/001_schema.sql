-- ============================================================
-- 001 — Skema inti aplikasi Scan LJK
-- Aman dijalankan ulang (idempotent).
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Profil pengguna (1-1 dengan auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'guru' check (role in ('admin','guru')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pengaturan sekolah (satu baris)
create table if not exists public.school_settings (
  id int primary key default 1 check (id = 1),
  school_name text not null default 'Nama Sekolah',
  address text,
  logo_path text,
  academic_year text not null default '2026/2027',
  semester text not null default 'Ganjil',
  headmaster text,
  passing_grade numeric(5,2) not null default 75 check (passing_grade between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.school_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  nip text unique,
  full_name text not null,
  email text,
  phone text,
  user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  full_name text not null,
  class_id uuid references public.classes(id) on delete set null,
  gender text check (gender in ('L','P')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_class_idx on public.students(class_id);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jadwal ujian
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_type text not null default 'UH' check (exam_type in ('UH','UTS','UAS','Lainnya')),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid references public.teachers(id) on delete set null,
  exam_date date not null,
  question_count int not null check (question_count between 5 and 60),
  option_count int not null default 5 check (option_count in (4,5)),
  pakets text[] not null default '{A}',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exams_date_idx on public.exams(exam_date);
create index if not exists exams_teacher_idx on public.exams(teacher_id);

-- Kunci jawaban per paket. answers = 1 huruf per soal (A–E);
-- '-' berarti soal dibatalkan (semua peserta dianggap benar).
create table if not exists public.answer_keys (
  exam_id uuid not null references public.exams(id) on delete cascade,
  paket text not null,
  answers text not null check (answers ~ '^[A-E-]+$'),
  updated_at timestamptz not null default now(),
  primary key (exam_id, paket)
);

-- Satu lembar LJK per siswa per ujian
create table if not exists public.ljk_sheets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  paket text not null default 'A',
  status text not null default 'belum' check (status in ('belum','discan')),
  answers text check (answers ~ '^[A-E*-]+$'),  -- '-' kosong, '*' ganda
  correct_count int,
  wrong_count int,
  blank_count int,
  score numeric(5,2),
  scanned_at timestamptz,
  scanned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index if not exists ljk_sheets_exam_idx on public.ljk_sheets(exam_id);
create index if not exists ljk_sheets_student_idx on public.ljk_sheets(student_id);
create index if not exists ljk_sheets_status_idx on public.ljk_sheets(status);

-- updated_at otomatis
do $$
declare t text;
begin
  foreach t in array array['profiles','school_settings','teachers','classes','students','subjects','exams','answer_keys','ljk_sheets']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Profil otomatis saat akun dibuat.
-- Akun pertama = admin aktif. Akun berikutnya = guru NONAKTIF sampai
-- diaktifkan admin (atau dibuat lewat Edge Function admin-users).
-- Role TIDAK diambil dari metadata klien (mencegah eskalasi hak akses).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when first_user then 'admin' else 'guru' end,
    first_user
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bentuk soal tidak boleh diubah jika sudah ada LJK yang discan
create or replace function public.guard_exam_shape()
returns trigger language plpgsql as $$
begin
  if (new.question_count <> old.question_count or new.option_count <> old.option_count or new.class_id <> old.class_id)
     and exists (select 1 from public.ljk_sheets where exam_id = old.id and status = 'discan') then
    raise exception 'Jumlah soal, opsi, atau kelas tidak dapat diubah karena sudah ada LJK yang discan';
  end if;
  if new.question_count <> old.question_count or new.option_count <> old.option_count then
    delete from public.answer_keys where exam_id = old.id; -- kunci lama tidak valid lagi
  end if;
  return new;
end $$;
drop trigger if exists trg_exams_guard on public.exams;
create trigger trg_exams_guard before update on public.exams
  for each row execute function public.guard_exam_shape();
