import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, BookOpen, CalendarClock, CalendarDays, CalendarPlus, ScanLine, Settings, UserCog, Users, ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Badge, Card, ErrorState, ProgressBar, Select, Skeleton, type Tone } from '@/components/ui'
import { Donut } from '@/components/charts'
import { cn, fmtDateShort, fmtNum, greeting, todayISO } from '@/lib/utils'
import type { Exam, ScoreStats } from '@/lib/types'

async function head(table: string, col?: string, val?: string | boolean): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (col !== undefined && val !== undefined) q = q.eq(col, val)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

function useSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const [teachers, teachersActive, students, studentsActive, subjects, sheets, scanned, exams, examSubjects] = await Promise.all([
        head('teachers'), head('teachers', 'is_active', true), head('students'), head('students', 'is_active', true),
        head('subjects'), head('ljk_sheets'), head('ljk_sheets', 'status', 'discan'), head('exams'),
        supabase.from('exams').select('subject_id'),
      ])
      if (examSubjects.error) throw examSubjects.error
      const used = new Set((examSubjects.data ?? []).map((r) => r.subject_id as string)).size
      return { teachers, teachersActive, students, studentsActive, subjects, subjectsUsed: used, sheets, scanned, exams }
    },
  })
}

const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100)

function Stat({ icon, tint, title, sub, label, value, bar }: { icon: ReactNode; tint: string; title: string; sub: string; label: string; value: number; bar: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', tint)}>{icon}</div>
        <div className="leading-tight">
          <p className="font-extrabold">{title}</p>
          <p className="text-xs text-ink-900/55">{sub}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs font-semibold text-ink-900/60">
        <span>{label}</span><span className="font-bold text-ink-900">{Math.round(value)}%</span>
      </div>
      <div className="mt-1.5"><ProgressBar value={value} color={bar} label={`${title} ${label}`} /></div>
    </Card>
  )
}

function Quick({ to, icon, tint, label, badge, tone }: { to: string; icon: ReactNode; tint: string; label: string; badge?: string; tone?: Tone }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}>{icon}</div>
      <span className="flex-1 text-sm font-bold leading-tight">{label}</span>
      {badge && <Badge tone={tone}>{badge}</Badge>}
    </Link>
  )
}

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth()
  const summary = useSummary()
  const [examId, setExamId] = useState('')

  const upcoming = useQuery({
    queryKey: ['dashboard', 'upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exams').select('*, subject:subjects(code,name), class:classes(name)')
        .gte('exam_date', todayISO()).order('exam_date').limit(3)
      if (error) throw error
      return (data ?? []) as unknown as Exam[]
    },
  })
  const examList = useQuery({
    queryKey: ['dashboard', 'exams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exams').select('id,title').order('exam_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as { id: string; title: string }[]
    },
  })
  const stats = useQuery({
    queryKey: ['dashboard', 'stats', examId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('score_stats', { p_exam_id: examId || null })
      if (error) throw error
      return (Array.isArray(data) ? data[0] : data) as ScoreStats
    },
  })

  const s = summary.data
  const st = stats.data
  const unscanned = s ? s.sheets - s.scanned : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="relative overflow-hidden rounded-3xl bg-peach p-7 md:p-8">
          <div className="relative z-10 max-w-md">
            <h1 className="text-3xl font-extrabold leading-tight">{greeting()},<br />{isAdmin ? 'Administrator' : profile?.full_name}!</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-900/80">Atur jadwal, cetak LJK, lalu scan lembar jawaban siswa dengan kamera. Nilai langsung dihitung otomatis.</p>
          </div>
          <svg viewBox="0 0 200 170" className="absolute -right-2 bottom-0 hidden h-44 sm:block" aria-hidden>
            <rect x="20" y="10" width="105" height="140" rx="12" fill="#FFE2B8" stroke="#fff" strokeWidth="2" />
            <rect x="34" y="24" width="40" height="7" rx="3.5" fill="#2A2475" />
            {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={42 + c * 21} cy={52 + r * 19} r="5.5" fill={(r + c * 2) % 3 === 0 ? '#2A2475' : 'none'} stroke="#2A2475" strokeWidth="1.6" />))}
            <rect x="95" y="62" width="85" height="90" rx="12" fill="#5B4FD1" />
            <rect x="104" y="71" width="67" height="72" rx="7" fill="#fff" />
            <line x1="104" y1="104" x2="171" y2="104" stroke="#E8505B" strokeWidth="2.5" />
            <circle cx="150" cy="32" r="16" fill="#4FBF8B" /><path d="M142 32l6 6 11-12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </section>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold">Ujian Terdekat</h2>
            <Link to="/jadwal" className="text-xs font-bold text-ink-900/70 hover:text-primary">Lihat semua</Link>
          </div>
          {upcoming.isLoading ? <Skeleton className="h-24" /> : upcoming.isError ? <ErrorState error={upcoming.error} onRetry={() => void upcoming.refetch()} /> :
            upcoming.data?.length === 0 ? <p className="py-6 text-center text-sm text-ink-900/55">Belum ada ujian mendatang.</p> : (
              <ul className="space-y-1">
                {upcoming.data?.map((e) => (
                  <li key={e.id}>
                    <Link to={`/jadwal/${e.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-canvas">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sun-soft text-sun-ink"><CalendarClock className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-bold">{e.title}</p>
                        <p className="truncate text-xs text-ink-900/55">{fmtDateShort(e.exam_date)} • {e.class?.name} • {e.question_count} soal</p>
                      </div>
                      <Badge tone="amber">{e.subject?.code}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <section aria-labelledby="ringkasan">
        <h2 id="ringkasan" className="mb-3 text-lg font-extrabold">Ringkasan Data</h2>
        {summary.isError ? <Card><ErrorState error={summary.error} onRetry={() => void summary.refetch()} /></Card> : !s ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<UserCog className="h-6 w-6" />} tint="bg-primary-soft text-primary" title="Data Guru" sub={`${s.teachers} guru terdaftar`} label="aktif" value={pct(s.teachersActive, s.teachers)} bar="bg-primary" />
            <Stat icon={<Users className="h-6 w-6" />} tint="bg-sun-soft text-sun-ink" title="Data Siswa" sub={`${s.students} siswa`} label="aktif" value={pct(s.studentsActive, s.students)} bar="bg-sun" />
            <Stat icon={<BookOpen className="h-6 w-6" />} tint="bg-sky-soft text-sky-ink" title="Mata Pelajaran" sub={`${s.subjects} mapel`} label="terpakai ujian" value={pct(s.subjectsUsed, s.subjects)} bar="bg-sky" />
            <Stat icon={<CalendarDays className="h-6 w-6" />} tint="bg-rose-soft text-rose-ink" title="Jadwal Ujian" sub={`${s.exams} ujian • ${s.sheets} LJK`} label="sudah discan" value={pct(s.scanned, s.sheets)} bar="bg-rose" />
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section aria-labelledby="akses">
          <h2 id="akses" className="mb-3 text-lg font-extrabold">Akses Cepat</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Quick to="/scan" icon={<ScanLine className="h-5 w-5" />} tint="bg-primary-soft text-primary" label="Scan LJK" badge={s ? `${unscanned} belum` : undefined} tone="amber" />
            <Quick to="/jadwal" icon={<CalendarPlus className="h-5 w-5" />} tint="bg-sun-soft text-sun-ink" label="Buat Jadwal Ujian" badge={s ? String(s.exams) : undefined} tone="cyan" />
            <Quick to="/rekap" icon={<BarChart3 className="h-5 w-5" />} tint="bg-sky-soft text-sky-ink" label="Rekap Nilai" badge={s ? `${s.scanned} hasil` : undefined} tone="green" />
            <Quick to="/siswa" icon={<Users className="h-5 w-5" />} tint="bg-rose-soft text-rose-ink" label="Data Siswa" badge={s ? String(s.students) : undefined} tone="rose" />
            {isAdmin && <Quick to="/pengaturan" icon={<Settings className="h-5 w-5" />} tint="bg-ink-100 text-ink-800" label="Pengaturan Sekolah" badge="ADMIN" tone="dark" />}
            <Quick to="/mapel" icon={<BookOpen className="h-5 w-5" />} tint="bg-mint-soft text-mint-ink" label="Mata Pelajaran" badge={s ? String(s.subjects) : undefined} tone="green" />
          </div>
        </section>

        <section aria-labelledby="statistik" className="rounded-3xl bg-ink-900 p-6 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="statistik" className="text-lg font-extrabold">Statistik Nilai</h2>
              <Select aria-label="Pilih ujian" value={examId} onChange={(e) => setExamId(e.target.value)}
                className="mt-2 h-9 max-w-[240px] border-white/20 bg-white/10 text-xs font-semibold text-white [&>option]:text-ink-900">
                <option value="">Semua ujian</option>
                {examList.data?.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </Select>
            </div>
            <Link to="/rekap" aria-label="Buka rekap nilai" className="rounded-xl p-2 text-white/70 hover:bg-white/10"><ChevronRight className="h-5 w-5" /></Link>
          </div>
          {stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} /> : !st || st.n === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-white/70">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm font-semibold">{stats.isLoading ? 'Memuat…' : 'Belum ada LJK yang discan'}</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-6">
              <dl className="space-y-3 text-sm">
                <div className="flex w-44 justify-between"><dt className="text-white/70">Rata-rata</dt><dd className="font-extrabold">{fmtNum(st.avg_score)}</dd></div>
                <div className="flex w-44 justify-between"><dt className="text-white/70">Tertinggi</dt><dd className="font-extrabold">{fmtNum(st.max_score, 0)}</dd></div>
                <div className="flex w-44 justify-between"><dt className="text-white/70">Terendah</dt><dd className="font-extrabold">{fmtNum(st.min_score, 0)}</dd></div>
                <div className="flex w-44 justify-between"><dt className="text-white/70">Jumlah LJK</dt><dd className="font-extrabold">{st.n}</dd></div>
              </dl>
              <Donut size={170} centerTop={String(Math.round(st.avg_score ?? 0))} centerBottom="rata-rata" slices={[
                { label: '≥ 85', value: st.b_a, color: '#62CDE0' }, { label: '70 – 84', value: st.b_b, color: '#F2B134' },
                { label: '55 – 69', value: st.b_c, color: '#A89BEF' }, { label: '< 55', value: st.b_d, color: '#E8505B' },
              ]} />
              <ul className="space-y-1.5 text-xs">
                {[['≥ 85', st.b_a, '#62CDE0'], ['70 – 84', st.b_b, '#F2B134'], ['55 – 69', st.b_c, '#A89BEF'], ['< 55', st.b_d, '#E8505B']].map(([l, n, c]) => (
                  <li key={l as string} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c as string }} aria-hidden />{l} <span className="text-white/60">({n})</span></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
