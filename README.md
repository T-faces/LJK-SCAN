# Scan LJK — Aplikasi Penilaian Ujian Pilihan Ganda

React + TypeScript + Vite + Tailwind, backend Supabase (Auth, Postgres + RLS, Storage, Edge Function).

## Fitur
Dashboard · Data Guru (+akun login) · Data Siswa (+kelas, impor tempel dari Excel) · Mata Pelajaran ·
Jadwal Ujian (kunci jawaban per paket A/B, LJK per siswa, cetak A4) · Scan LJK (kamera/unggah, QR identitas,
koreksi manual) · Rekap Nilai (KKM, ekspor CSV, analisis butir soal) · Pengaturan Sekolah (kop, logo, KKM).

## Instalasi
1. `npm install`
2. Buat project di supabase.com. Di **SQL Editor** jalankan berurutan isi `supabase/migrations/001…004`.
3. **Authentication → Providers → Email**: matikan *Allow new users to sign up* (akun dibuat admin).
4. **Authentication → Users → Add user**: buat akun admin pertama (centang auto-confirm). Akun PERTAMA otomatis jadi admin aktif.
5. Salin `.env.example` → `.env.local`, isi URL dan anon key.
6. Deploy Edge Function (untuk membuat akun guru dari aplikasi):
   `supabase login && supabase link --project-ref <ref> && supabase functions deploy admin-users`
7. `npm run dev` → buka http://localhost:5173 (kamera butuh HTTPS atau localhost).

## Alur pemakaian
Pengaturan Sekolah → Kelola Kelas & impor siswa → Mapel → Jadwal Ujian → isi **Kunci Jawaban** →
**LJK Siswa → Buat LJK** → **Cetak LJK** (A4, skala 100%, tanpa margin) → siswa mengisi →
**Scan LJK** → periksa kotak kuning (kosong/ganda) → Simpan → **Rekap Nilai**.

## Keamanan
RLS aktif di semua tabel. Admin penuh; guru hanya ujian miliknya (`exams.teacher_id` = guru yang tertaut ke akunnya).
Nilai dihitung di database (`save_scan`, `save_answer_key`), bukan di browser. `anon` tidak punya akses.
Role tidak dapat dinaikkan dari klien; hanya Edge Function (service role) yang membuat akun guru.

## Cara kerja OMR
4 kotak hitam sudut → homografi meluruskan foto ke kanvas A4 → QR `LJK1:<id lembar>` → tiap gelembung dibandingkan
dengan celah kertas di barisnya (tahan cahaya tak merata). Kode: `src/lib/omr/`. Tata letak cetak & baca memakai
`layout.ts` yang sama. Uji tanpa kamera: `npm run test:omr`.

## Batasan
Maks. 60 soal, 4–5 pilihan, satu LJK per halaman A4. Soal dibatalkan = tanda "batal" pada kunci (semua dianggap benar).
Backup: Supabase Dashboard → Database → Backups (atau `supabase db dump`).
