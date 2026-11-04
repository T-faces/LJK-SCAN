import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useList } from '@/lib/crud'
import { useSchool } from '@/lib/hooks'
import { cn, downloadCsv, fmtNum } from '@/lib/utils'
import type { Exam, ScoreStats, Sheet } from '@/lib/types'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pager, SearchInput, Select, Skeleton, TableWrap, Td, Th, usePaged } from '@/components/ui'

type Row = Sheet & { exam: Exam }

export default function RekapPage() {
  const { data: school } = useSchool()
  const exams = useList<Exam>('exams', '*, subject:subjects(code,name), class:classes(name)', { column: 'exam_date', ascending: false })
  const [examId, setExamId] = useState('')
  const [q, setQ] = useState('')
  const kkm = school?.passing_grade ?? 75

  const sheets = useQuery({
    queryKey: ['rekap', 'sheets', examId],
    queryFn: async () => {
      let qy = supabase.from('ljk_sheets').select('*, student:students(nis,full_name,class:classes(name)), exam:exams(title,question_count,exam_date, subject:subjects(code,name))').eq('status', 'discan')
      if (examId) qy = qy.eq('exam_id', examId)
      const { data, error } = await qy.order('score', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Row[]
    },
  })
  const stats = useQuery({
    queryKey: ['rekap', 'stats', examId],
    queryFn: async () => { const { data, error } = await supabase.rpc('score_stats', { p_exam_id: examId || null }); if (error) throw error; return (Array.isArray(data) ? data[0] : data) as ScoreStats },
  })
  const keys = useQuery({
    queryKey: ['rekap', 'keys', examId], enabled: !!examId,
    queryFn: async () => { const { data, error } = await supabase.from('answer_keys').select('paket,answers').eq('exam_id', examId); if (error) throw error; return Object.fromEntries((data ?? []).map((k) => [k.paket as string, k.answers as string])) },
  })

  const rows = useMemo(() => (sheets.data ?? []).filter((r) => `${r.student?.nis} ${r.student?.full_name}`.toLowerCase().includes(q.toLowerCase())), [sheets.data, q])
  const pg = usePaged(rows, 15)
  const st = stats.data
  const lulus = rows.filter((r) => (r.score ?? 0) >= kkm).length

  // Analisis butir soal: % siswa yang menjawab benar per nomor
  const items = useMemo(() => {
    const ex = exams.data?.find((e) => e.id === examId)
    if (!ex || !keys.data || !sheets.data?.length) return null
    return Array.from({ length: ex.question_count }, (_, i) => {
      let ok = 0, n = 0
      for (const s of sheets.data) {
        const k = keys.data[s.paket]?.[i]
        if (!k || !s.answers) continue
        n++
        if (k === '-' || s.answers[i] === k) ok++
      }
      return { no: i + 1, pct: n ? (ok / n) * 100 : 0 }
    })
  }, [exams.data, examId, keys.data, sheets.data])

  const exportCsv = () => downloadCsv(`rekap-nilai${examId ? '-' + (exams.data?.find((e) => e.id === examId)?.title ?? '').replace(/\s+/g, '-') : ''}.csv`, [
    ['NIS', 'Nama', 'Kelas', 'Ujian', 'Paket', 'Benar', 'Salah', 'Kosong', 'Nilai', `Keterangan (KKM ${kkm})`],
    ...rows.map((r) => [r.student?.nis ?? '', r.student?.full_name ?? '', r.student?.class?.name ?? '', r.exam?.title ?? '', r.paket, r.correct_count, r.wrong_count, r.blank_count, r.score, (r.score ?? 0) >= kkm ? 'Tuntas' : 'Belum tuntas']),
  ])

  return (
    <>
      <PageHeader title="Rekap Nilai" subtitle={`KKM ${kkm} (atur di Pengaturan Sekolah).`} actions={<Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" />Ekspor CSV</Button>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Rata-rata', fmtNum(st?.avg_score)], ['Tertinggi', fmtNum(st?.max_score, 0)], ['Terendah', fmtNum(st?.min_score, 0)], ['Tuntas', rows.length ? `${lulus}/${rows.length}` : '–']].map(([l, v]) => (
          <Card key={l} className="px-5 py-4"><p className="text-xs font-bold uppercase tracking-wide text-ink-900/50">{l}</p><p className="mt-1 text-2xl font-extrabold">{stats.isLoading ? '…' : v}</p></Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Cari NIS atau nama…" className="min-w-56 flex-1 sm:max-w-xs" />
          <Select aria-label="Pilih ujian" value={examId} onChange={(e) => { setExamId(e.target.value); setQ('') }} className="w-full sm:w-72">
            <option value="">Semua ujian</option>{exams.data?.map((e) => <option key={e.id} value={e.id}>{e.title} — {e.class?.name}</option>)}
          </Select>
        </div>
        {sheets.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> :
          sheets.error ? <ErrorState error={sheets.error} onRetry={() => void sheets.refetch()} /> :
          rows.length === 0 ? <EmptyState title="Belum ada hasil" text="Nilai muncul di sini setelah LJK discan dan disimpan." /> : (
            <>
              <TableWrap>
                <thead><tr><Th>#</Th><Th>NIS</Th><Th>Nama</Th><Th>Kelas</Th>{!examId && <Th>Ujian</Th>}<Th>Paket</Th><Th>Benar</Th><Th>Salah</Th><Th>Kosong</Th><Th>Nilai</Th><Th>Ket.</Th></tr></thead>
                <tbody>
                  {pg.slice.map((r, i) => (
                    <tr key={r.id} className="hover:bg-canvas/50">
                      <Td className="tabular-nums text-ink-900/50">{(pg.page - 1) * pg.size + i + 1}</Td>
                      <Td className="tabular-nums">{r.student?.nis}</Td>
                      <Td className="font-semibold">{r.student?.full_name}</Td>
                      <Td>{r.student?.class?.name}</Td>
                      {!examId && <Td>{r.exam?.title}</Td>}
                      <Td>{r.paket}</Td>
                      <Td className="tabular-nums text-mint-ink">{r.correct_count}</Td>
                      <Td className="tabular-nums text-rose-ink">{r.wrong_count}</Td>
                      <Td className="tabular-nums">{r.blank_count}</Td>
                      <Td className="text-base font-extrabold tabular-nums">{fmtNum(r.score)}</Td>
                      <Td><Badge tone={(r.score ?? 0) >= kkm ? 'green' : 'rose'}>{(r.score ?? 0) >= kkm ? 'Tuntas' : 'Belum'}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pager {...pg} />
            </>
          )}
      </Card>

      {items && (
        <Card className="mt-5 p-5">
          <h2 className="font-extrabold">Analisis Butir Soal</h2>
          <p className="mb-4 text-xs text-ink-900/60">Persentase siswa yang menjawab benar tiap nomor. Merah = sulit (&lt; 40%), kuning = sedang, hijau = mudah (≥ 70%).</p>
          <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.no} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs font-bold tabular-nums text-ink-900/50">{it.no}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100/70" role="img" aria-label={`Soal ${it.no}: ${Math.round(it.pct)}% benar`}>
                  <div className={cn('h-full rounded-full', it.pct < 40 ? 'bg-rose' : it.pct < 70 ? 'bg-sun' : 'bg-mint')} style={{ width: `${it.pct}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-bold tabular-nums">{Math.round(it.pct)}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
