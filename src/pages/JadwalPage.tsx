import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useList, useRemove, useSave } from '@/lib/crud'
import { fmtDateShort, todayISO } from '@/lib/utils'
import type { ClassRoom, Exam, Subject, Teacher } from '@/lib/types'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pager, ProgressBar, SearchInput, Select, Skeleton, TableWrap, Td, Th, useToast, usePaged } from '@/components/ui'

const schema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(120),
  exam_type: z.enum(['UH', 'UTS', 'UAS', 'Lainnya']),
  subject_id: z.string().min(1, 'Pilih mata pelajaran'),
  class_id: z.string().min(1, 'Pilih kelas'),
  teacher_id: z.string().optional(),
  exam_date: z.string().min(1, 'Tanggal wajib diisi'),
  question_count: z.coerce.number({ invalid_type_error: 'Isi angka' }).int().min(5, 'Minimal 5 soal').max(60, 'Maksimal 60 soal'),
  option_count: z.enum(['4', '5']),
  pakets: z.enum(['A', 'A,B']),
})
type Form = z.input<typeof schema>

export default function JadwalPage() {
  const { isAdmin, teacher } = useAuth()
  const toast = useToast()
  const exams = useList<Exam>('exams', '*, subject:subjects(code,name), class:classes(name), teacher:teachers(full_name)', { column: 'exam_date', ascending: false })
  const subjects = useList<Subject>('subjects', '*', { column: 'name' })
  const classes = useList<ClassRoom>('classes', '*', { column: 'name' })
  const teachers = useList<Teacher>('teachers', '*', { column: 'full_name' })
  const counts = useQuery({
    queryKey: ['exam_sheet_counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exam_sheet_counts')
      if (error) throw error
      return new Map((data as { exam_id: string; total: number; scanned: number }[]).map((r) => [r.exam_id, r]))
    },
  })

  const [q, setQ] = useState('')
  const [cls, setCls] = useState('')
  const [editing, setEditing] = useState<Exam | 'new' | null>(null)
  const [del, setDel] = useState<Exam | null>(null)

  const rows = useMemo(() => (exams.data ?? []).filter((e) => (!cls || e.class_id === cls) && `${e.title} ${e.subject?.name ?? ''}`.toLowerCase().includes(q.toLowerCase())), [exams.data, q, cls])
  const pg = usePaged(rows, 10)

  const blank: Form = { title: '', exam_type: 'UH', subject_id: '', class_id: '', teacher_id: teacher?.id ?? '', exam_date: todayISO(), question_count: 20, option_count: '5', pakets: 'A' }
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: blank })
  const save = useSave('exams', () => { toast.success('Jadwal ujian disimpan'); setEditing(null) }, toast.error)
  const remove = useRemove('exams', () => { toast.success('Jadwal ujian dihapus'); setDel(null) }, (m) => { toast.error(m); setDel(null) })

  const locked = editing && editing !== 'new' ? (counts.data?.get(editing.id)?.scanned ?? 0) > 0 : false

  const open = (e: Exam | 'new') => {
    reset(e === 'new' ? blank : {
      title: e.title, exam_type: e.exam_type, subject_id: e.subject_id, class_id: e.class_id, teacher_id: e.teacher_id ?? '', exam_date: e.exam_date,
      question_count: e.question_count, option_count: String(e.option_count) as '4' | '5', pakets: e.pakets.length > 1 ? 'A,B' : 'A',
    })
    setEditing(e)
  }
  const onSubmit = (raw: Form) => {
    const v = schema.parse(raw)
    const teacherId = isAdmin ? (v.teacher_id || null) : teacher?.id ?? null
    if (!isAdmin && !teacherId) { toast.error('Akun Anda belum terhubung ke data guru. Hubungi admin.'); return }
    save.mutate({
      title: v.title, exam_type: v.exam_type, subject_id: v.subject_id, class_id: v.class_id, teacher_id: teacherId, exam_date: v.exam_date,
      question_count: v.question_count, option_count: Number(v.option_count), pakets: v.pakets.split(','),
      ...(editing && editing !== 'new' ? { id: editing.id } : {}),
    })
  }

  return (
    <>
      <PageHeader title="Jadwal Ujian" subtitle="Buat ujian, atur kunci jawaban, dan kelola LJK tiap siswa."
        actions={<Button onClick={() => open('new')}><Plus className="h-4 w-4" />Buat Jadwal</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Cari judul atau mapel…" className="min-w-56 flex-1 sm:max-w-sm" />
          <Select aria-label="Filter kelas" value={cls} onChange={(e) => setCls(e.target.value)} className="w-48">
            <option value="">Semua kelas</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        {exams.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> :
          exams.error ? <ErrorState error={exams.error} onRetry={() => void exams.refetch()} /> :
          rows.length === 0 ? <EmptyState title={q || cls ? 'Tidak ada hasil' : 'Belum ada jadwal ujian'} text={q || cls ? 'Ubah kata kunci atau filter.' : 'Buat jadwal ujian pertama, lalu isi kunci jawaban dan buat LJK siswa.'} action={!q && !cls && <Button onClick={() => open('new')}><Plus className="h-4 w-4" />Buat Jadwal</Button>} /> : (
            <>
              <TableWrap>
                <thead><tr><Th>Ujian</Th><Th>Tanggal</Th><Th>Kelas</Th><Th>Soal</Th><Th>Progres scan</Th><Th className="text-right">Aksi</Th></tr></thead>
                <tbody>
                  {pg.slice.map((e) => {
                    const c = counts.data?.get(e.id)
                    const pct = c && c.total ? (c.scanned / c.total) * 100 : 0
                    return (
                      <tr key={e.id} className="hover:bg-canvas/50">
                        <Td>
                          <Link to={`/jadwal/${e.id}`} className="font-bold hover:text-primary">{e.title}</Link>
                          <div className="mt-1 flex items-center gap-1.5"><Badge tone="amber">{e.subject?.code}</Badge><Badge>{e.exam_type}</Badge>{e.pakets.length > 1 && <Badge tone="indigo">Paket A/B</Badge>}</div>
                        </Td>
                        <Td className="whitespace-nowrap">{fmtDateShort(e.exam_date)}</Td>
                        <Td>{e.class?.name}</Td>
                        <Td>{e.question_count}</Td>
                        <Td className="min-w-40">
                          <p className="mb-1 text-xs font-semibold text-ink-900/60">{c ? `${c.scanned}/${c.total} LJK` : 'Belum ada LJK'}</p>
                          <ProgressBar value={pct} color="bg-rose" label={`Progres scan ${e.title}`} />
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          <Link to={`/jadwal/${e.id}`} aria-label={`Kunci & LJK ${e.title}`} title="Kunci jawaban & LJK" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-900/70 hover:bg-ink-100/60"><ListChecks className="h-4 w-4" /></Link>
                          <Button variant="ghost" size="icon" aria-label={`Ubah ${e.title}`} onClick={() => open(e)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label={`Hapus ${e.title}`} onClick={() => setDel(e)}><Trash2 className="h-4 w-4 text-rose" /></Button>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </TableWrap>
              <Pager {...pg} />
            </>
          )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="lg" title={editing === 'new' ? 'Buat Jadwal Ujian' : 'Ubah Jadwal Ujian'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button loading={save.isPending} onClick={() => void handleSubmit(onSubmit)()}>Simpan</Button></>}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)() }} noValidate>
          <Field label="Judul ujian" error={errors.title?.message} className="sm:col-span-2"><Input placeholder="mis. UH Matematika Bab 3" {...register('title')} /></Field>
          <Field label="Jenis" error={errors.exam_type?.message}><Select {...register('exam_type')}><option value="UH">Ulangan Harian (UH)</option><option value="UTS">UTS</option><option value="UAS">UAS</option><option value="Lainnya">Lainnya</option></Select></Field>
          <Field label="Tanggal" error={errors.exam_date?.message}><Input type="date" {...register('exam_date')} /></Field>
          <Field label="Mata pelajaran" error={errors.subject_id?.message}><Select {...register('subject_id')}><option value="">Pilih…</option>{subjects.data?.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</Select></Field>
          <Field label="Kelas" error={errors.class_id?.message} hint={locked ? 'Terkunci: sudah ada LJK yang discan' : undefined}><Select disabled={locked} {...register('class_id')}><option value="">Pilih…</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Jumlah soal" error={errors.question_count?.message} hint={locked ? 'Terkunci: sudah ada LJK yang discan' : 'Maksimal 60 soal per LJK'}><Input type="number" inputMode="numeric" min={5} max={60} disabled={locked} {...register('question_count')} /></Field>
          <Field label="Jumlah pilihan"><Select disabled={locked} {...register('option_count')}><option value="5">5 (A–E)</option><option value="4">4 (A–D)</option></Select></Field>
          <Field label="Paket soal" hint="Paket A/B dibagi selang-seling untuk mengurangi contekan"><Select {...register('pakets')}><option value="A">1 paket (A)</option><option value="A,B">2 paket (A &amp; B)</option></Select></Field>
          {isAdmin && (
            <Field label="Guru pengampu"><Select {...register('teacher_id')}><option value="">– Belum ditentukan –</option>{teachers.data?.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</Select></Field>
          )}
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus jadwal ujian?" text={`“${del?.title}” beserta kunci jawaban, seluruh LJK dan nilai siswa akan dihapus permanen.`} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onClose={() => setDel(null)} />
    </>
  )
}
