import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eraser, Printer, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { OPTION_LETTERS } from '@/lib/omr/layout'
import { cn, errMsg, fmtDate, fmtNum } from '@/lib/utils'
import type { Exam, Sheet } from '@/lib/types'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Pager, SearchInput, Select, Skeleton, TableWrap, Td, Th, Tabs, useToast, usePaged } from '@/components/ui'

export default function JadwalDetailPage() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState<'kunci' | 'ljk'>('kunci')
  const exam = useQuery({
    queryKey: ['exam', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('exams').select('*, subject:subjects(code,name), class:classes(name), teacher:teachers(full_name)').eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as Exam | null
    },
  })
  const keys = useQuery({
    queryKey: ['keys', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('answer_keys').select('paket,answers').eq('exam_id', id)
      if (error) throw error
      return Object.fromEntries((data ?? []).map((k) => [k.paket as string, k.answers as string]))
    },
  })

  if (exam.isLoading) return <Skeleton className="h-64 rounded-3xl" />
  if (exam.error) return <Card><ErrorState error={exam.error} onRetry={() => void exam.refetch()} /></Card>
  const e = exam.data
  if (!e) return <Card><EmptyState title="Ujian tidak ditemukan" text="Ujian mungkin sudah dihapus atau Anda tidak punya akses." action={<Link to="/jadwal"><Button variant="outline">Kembali ke jadwal</Button></Link>} /></Card>

  return (
    <>
      <Link to="/jadwal" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900/60 hover:text-primary"><ArrowLeft className="h-4 w-4" />Jadwal ujian</Link>
      <PageHeader title={e.title} subtitle={`${e.subject?.name} • ${e.class?.name} • ${fmtDate(e.exam_date)} • ${e.question_count} soal (${OPTION_LETTERS.slice(0, e.option_count).join('')})`}
        actions={<><Link to={`/cetak/${e.id}`}><Button variant="outline"><Printer className="h-4 w-4" />Cetak LJK</Button></Link><Link to="/scan"><Button variant="dark">Scan LJK</Button></Link></>} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'kunci', label: 'Kunci Jawaban' }, { value: 'ljk', label: 'LJK Siswa' }]} /></div>
      {tab === 'kunci' ? <KeyEditor exam={e} saved={keys.data ?? {}} /> : <SheetsTab exam={e} hasKey={(p) => !!keys.data?.[p]} />}
    </>
  )
}

/* ───────── Editor kunci jawaban ───────── */
function KeyEditor({ exam, saved }: { exam: Exam; saved: Record<string, string> }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [paket, setPaket] = useState(exam.pakets[0])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const letters = OPTION_LETTERS.slice(0, exam.option_count)
  const n = exam.question_count
  const blank = '_'.repeat(n)

  // Sinkronkan draft hanya saat isi kunci tersimpan benar-benar berubah (bukan tiap render).
  const sig = JSON.stringify(saved) + exam.pakets.join() + n
  useEffect(() => {
    setDraft(Object.fromEntries(exam.pakets.map((p) => [p, saved[p] ?? blank])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const cur = draft[paket] ?? blank
  const filled = [...cur].filter((c) => c !== '_').length
  const setAt = (i: number, ch: string) => setDraft((d) => ({ ...d, [paket]: (d[paket] ?? blank).slice(0, i) + ch + (d[paket] ?? blank).slice(i + 1) }))
  const dirty = cur !== (saved[paket] ?? blank)

  const [paste, setPaste] = useState('')
  const applyPaste = () => {
    const s = paste.toUpperCase().replace(/[^A-E-]/g, '')
    if (s.length !== n) { toast.error(`Kunci harus ${n} karakter (terbaca ${s.length}). Gunakan huruf ${letters[0]}–${letters[letters.length - 1]}.`); return }
    if (exam.option_count === 4 && s.includes('E')) { toast.error('Ujian ini hanya memiliki pilihan A–D'); return }
    setDraft((d) => ({ ...d, [paket]: s })); setPaste('')
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('save_answer_key', { p_exam: exam.id, p_paket: paket, p_answers: cur })
      if (error) throw error
      return data as number
    },
    onSuccess: (rescored) => { toast.success(rescored > 0 ? `Kunci paket ${paket} disimpan. ${rescored} LJK dinilai ulang.` : `Kunci paket ${paket} disimpan`); void qc.invalidateQueries() },
    onError: (e) => toast.error(errMsg(e)),
  })

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {exam.pakets.length > 1 && <Tabs value={paket} onChange={setPaket} items={exam.pakets.map((p) => ({ value: p, label: `Paket ${p}` }))} />}
          <Badge tone={saved[paket] ? 'green' : 'amber'}>{saved[paket] ? 'Tersimpan' : 'Belum disimpan'}</Badge>
        </div>
        <p className="text-sm font-semibold text-ink-900/60">{filled}/{n} soal terisi</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={`Tempel kunci sekaligus, mis. ${'ABCDE'.repeat(Math.ceil(n / 5)).slice(0, n)}`} aria-label="Tempel kunci jawaban" className="min-w-64 flex-1 font-mono tracking-wider" onKeyDown={(e) => { if (e.key === 'Enter') applyPaste() }} />
        <Button variant="soft" onClick={applyPaste} disabled={!paste}>Terapkan</Button>
        <Button variant="ghost" onClick={() => setDraft((d) => ({ ...d, [paket]: blank }))}><Eraser className="h-4 w-4" />Kosongkan</Button>
      </div>

      <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-canvas/70">
            <span className="w-7 text-right text-xs font-extrabold tabular-nums text-ink-900/50">{i + 1}</span>
            <div role="radiogroup" aria-label={`Kunci soal ${i + 1}`} className="flex gap-1">
              {letters.map((l) => (
                <button key={l} role="radio" aria-checked={cur[i] === l} onClick={() => setAt(i, cur[i] === l ? '_' : l)}
                  className={cn('h-8 w-8 rounded-full border text-xs font-bold transition', cur[i] === l ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-100 bg-white text-ink-900/70 hover:border-primary')}>{l}</button>
              ))}
              <button role="radio" aria-checked={cur[i] === '-'} title="Soal dibatalkan: semua peserta dianggap benar" onClick={() => setAt(i, cur[i] === '-' ? '_' : '-')}
                className={cn('h-8 rounded-full border px-2 text-[10px] font-bold transition', cur[i] === '-' ? 'border-rose bg-rose text-white' : 'border-ink-100 bg-white text-ink-900/40 hover:border-rose')}>batal</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100/60 pt-4">
        <p className="text-xs text-ink-900/55">“batal” = soal dibatalkan; semua peserta mendapat nilai benar untuk soal itu. Menyimpan kunci akan menilai ulang LJK paket ini yang sudah discan.</p>
        <Button loading={save.isPending} disabled={filled < n || !dirty} onClick={() => save.mutate()}>Simpan kunci {exam.pakets.length > 1 ? `paket ${paket}` : ''}</Button>
      </div>
    </Card>
  )
}

/* ───────── Daftar LJK siswa ───────── */
function SheetsTab({ exam, hasKey }: { exam: Exam; hasKey: (p: string) => boolean }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [alt, setAlt] = useState(exam.pakets.length > 1)
  const [del, setDel] = useState<Sheet | null>(null)

  const sheets = useQuery({
    queryKey: ['sheets', exam.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('ljk_sheets').select('*, student:students(nis,full_name)').eq('exam_id', exam.id)
      if (error) throw error
      return ((data ?? []) as unknown as Sheet[]).sort((a, b) => (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? ''))
    },
  })
  const rows = useMemo(() => (sheets.data ?? []).filter((s) => `${s.student?.nis} ${s.student?.full_name}`.toLowerCase().includes(q.toLowerCase())), [sheets.data, q])
  const pg = usePaged(rows, 15)

  const inv = () => void qc.invalidateQueries()
  const gen = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc('generate_sheets', { p_exam_id: exam.id, p_alternate: alt }); if (error) throw error; return data as number },
    onSuccess: (n) => { toast.success(n > 0 ? `${n} LJK dibuat` : 'Semua siswa aktif di kelas ini sudah memiliki LJK'); inv() },
    onError: (e) => toast.error(errMsg(e)),
  })
  const setPaket = useMutation({
    mutationFn: async ({ id, paket }: { id: string; paket: string }) => { const { error } = await supabase.from('ljk_sheets').update({ paket }).eq('id', id); if (error) throw error },
    onSuccess: inv, onError: (e) => toast.error(errMsg(e)),
  })
  const reset = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('reset_scan', { p_sheet_id: id }); if (error) throw error },
    onSuccess: () => { toast.success('Hasil scan direset'); inv() }, onError: (e) => toast.error(errMsg(e)),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('ljk_sheets').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { toast.success('LJK dihapus'); setDel(null); inv() }, onError: (e) => { toast.error(errMsg(e)); setDel(null) },
  })

  const total = sheets.data?.length ?? 0
  const scanned = sheets.data?.filter((s) => s.status === 'discan').length ?? 0
  const missingKey = exam.pakets.filter((p) => !hasKey(p))

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => gen.mutate()} loading={gen.isPending}><UserPlus className="h-4 w-4" />Buat / lengkapi LJK kelas</Button>
          {exam.pakets.length > 1 && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" checked={alt} onChange={(e) => setAlt(e.target.checked)} />Bagi paket A/B selang-seling</label>}
        </div>
        <p className="text-sm font-semibold text-ink-900/60">{scanned}/{total} discan</p>
      </div>
      {missingKey.length > 0 && <p role="status" className="mx-4 mb-3 rounded-xl bg-sun-soft px-3 py-2 text-xs font-semibold text-sun-ink">Kunci jawaban paket {missingKey.join(', ')} belum disimpan — LJK paket tersebut belum bisa dinilai saat discan.</p>}
      <div className="px-4 pb-3"><SearchInput value={q} onChange={setQ} placeholder="Cari NIS atau nama…" className="max-w-sm" /></div>
      {sheets.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> :
        sheets.error ? <ErrorState error={sheets.error} onRetry={() => void sheets.refetch()} /> :
        total === 0 ? <EmptyState title="Belum ada LJK" text={`Klik “Buat / lengkapi LJK kelas” untuk membuat satu LJK per siswa aktif di ${exam.class?.name}.`} /> : (
          <>
            <TableWrap>
              <thead><tr><Th>NIS</Th><Th>Nama</Th><Th>Paket</Th><Th>Status</Th><Th>Nilai</Th><Th className="text-right">Aksi</Th></tr></thead>
              <tbody>
                {pg.slice.map((s) => (
                  <tr key={s.id} className="hover:bg-canvas/50">
                    <Td className="tabular-nums">{s.student?.nis}</Td>
                    <Td className="font-semibold">{s.student?.full_name}</Td>
                    <Td>
                      {exam.pakets.length > 1 && s.status === 'belum'
                        ? <Select aria-label={`Paket ${s.student?.full_name}`} className="h-9 w-24" value={s.paket} onChange={(e) => setPaket.mutate({ id: s.id, paket: e.target.value })}>{exam.pakets.map((p) => <option key={p}>{p}</option>)}</Select>
                        : <Badge tone="indigo">{s.paket}</Badge>}
                    </Td>
                    <Td><Badge tone={s.status === 'discan' ? 'green' : 'amber'}>{s.status === 'discan' ? 'Sudah discan' : 'Belum'}</Badge></Td>
                    <Td className="font-extrabold tabular-nums">{fmtNum(s.score)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <Link to={`/cetak/${exam.id}?sheet=${s.id}`} aria-label={`Cetak LJK ${s.student?.full_name}`} title="Cetak LJK" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-900/70 hover:bg-ink-100/60"><Printer className="h-4 w-4" /></Link>
                      {s.status === 'discan' && <Button variant="ghost" size="icon" aria-label={`Reset scan ${s.student?.full_name}`} title="Reset hasil scan" onClick={() => reset.mutate(s.id)}><RotateCcw className="h-4 w-4" /></Button>}
                      <Button variant="ghost" size="icon" aria-label={`Hapus LJK ${s.student?.full_name}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-rose" /></Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pager {...pg} />
          </>
        )}
      <ConfirmDialog open={!!del} title="Hapus LJK siswa?" text={`LJK ${del?.student?.full_name} beserta nilainya akan dihapus. Anda dapat membuatnya lagi lewat “Buat / lengkapi LJK kelas”.`} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onClose={() => setDel(null)} />
    </Card>
  )
}
