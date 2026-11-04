import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CameraOff, CheckCircle2, ImageUp, RefreshCw, Save, TriangleAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GRID, OPTION_LETTERS, bubbleCenter } from '@/lib/omr/layout'
import { PX_PER_MM, readAnswers, type Gray } from '@/lib/omr/omr'
import { grayToCanvas, previewScore, processImage, sheetIdFromPayload, sourceToGray } from '@/lib/scan'
import { cn, errMsg, fmtNum } from '@/lib/utils'
import type { Exam, Sheet } from '@/lib/types'
import { Badge, Button, Card, EmptyState, Field, Select, Spinner, useToast } from '@/components/ui'

type FullSheet = Sheet & { exam: Exam; student: NonNullable<Sheet['student']> }

interface Review { page: Gray; sheet: FullSheet; key: string | null; answers: string; darkness: number[][]; manual: boolean }

const SHEET_SELECT = '*, student:students(nis,full_name,class:classes(name)), exam:exams(*, subject:subjects(code,name), class:classes(name))'

export default function ScanPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [camOn, setCamOn] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  // Foto yang QR-nya gagal dibaca → pilih LJK manual
  const [pending, setPending] = useState<Gray | null>(null)

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamOn(false)
  }, [])
  useEffect(() => stopCam, [stopCam])

  const startCam = async () => {
    setCamErr('')
    if (!navigator.mediaDevices?.getUserMedia) { setCamErr('Kamera hanya tersedia lewat HTTPS atau localhost.'); return }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      streamRef.current = s
      setCamOn(true)
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play() } })
    } catch (e) {
      setCamErr(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau gunakan tombol Unggah foto.' : 'Kamera tidak dapat dibuka. Gunakan tombol Unggah foto.')
    }
  }

  const loadSheet = async (id: string): Promise<FullSheet | null> => {
    const { data, error } = await supabase.from('ljk_sheets').select(SHEET_SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return data as unknown as FullSheet | null
  }

  const finish = async (page: Gray, sheet: FullSheet, manual: boolean) => {
    const { data: k, error } = await supabase.from('answer_keys').select('answers').eq('exam_id', sheet.exam_id).eq('paket', sheet.paket).maybeSingle()
    if (error) throw error
    const r = readAnswers(page, sheet.exam.question_count, sheet.exam.option_count)
    setReview({ page, sheet, key: (k?.answers as string | undefined) ?? null, answers: r.answers, darkness: r.darkness, manual })
    setPending(null)
  }

  const handleGray = async (gray: Gray) => {
    setBusy(true); setProblem(''); setReview(null); setPending(null)
    try {
      await new Promise((r) => setTimeout(r, 30)) // beri kesempatan UI menampilkan "memproses"
      const res = processImage(gray)
      if (!res.ok) { setProblem(res.reason); return }
      const id = sheetIdFromPayload(res.payload)
      if (!id) { setPending(res.page); return }
      const sheet = await loadSheet(id)
      if (!sheet) { setProblem('LJK tidak ditemukan di database, atau Anda tidak punya akses ke ujian ini.'); return }
      await finish(res.page, sheet, false)
    } catch (e) {
      setProblem(errMsg(e))
    } finally { setBusy(false) }
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    void handleGray(sourceToGray(v, v.videoWidth, v.videoHeight))
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const bmp = await createImageBitmap(f)
      void handleGray(sourceToGray(bmp, bmp.width, bmp.height))
      bmp.close()
    } catch { setProblem('Berkas gambar tidak dapat dibaca.') }
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!review) throw new Error('Tidak ada data')
      const { data, error } = await supabase.rpc('save_scan', { p_sheet_id: review.sheet.id, p_answers: review.answers })
      if (error) throw error
      return data as Sheet
    },
    onSuccess: (s) => {
      toast.success(`${review?.sheet.student.full_name}: nilai ${fmtNum(s.score)} (${s.correct_count} benar)`)
      setReview(null); void qc.invalidateQueries()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  return (
    <>
      <div className="mb-5"><h1 className="text-2xl font-extrabold tracking-tight">Scan LJK</h1><p className="mt-0.5 text-sm text-ink-900/60">Arahkan kamera ke lembar jawaban. Identitas siswa dibaca otomatis dari kode QR.</p></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="h-fit p-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-900">
            {camOn ? <video ref={videoRef} playsInline muted className="h-full w-full object-contain" /> : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white/70"><CameraOff className="h-8 w-8" /><p className="text-sm">Kamera belum aktif</p></div>
            )}
            {busy && <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60"><div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold"><Spinner />Memproses…</div></div>}
          </div>
          {camErr && <p role="alert" className="mt-3 rounded-xl bg-rose-soft px-3 py-2 text-xs font-medium text-rose-ink">{camErr}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!camOn ? <Button onClick={() => void startCam()}><Camera className="h-4 w-4" />Nyalakan kamera</Button> : (
              <><Button onClick={capture} disabled={busy}><Camera className="h-4 w-4" />Ambil &amp; proses</Button><Button variant="outline" onClick={stopCam}>Matikan</Button></>
            )}
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><ImageUp className="h-4 w-4" />Unggah foto</Button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Unggah foto LJK" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-ink-900/60">
            <li>• Letakkan LJK di permukaan gelap dan datar, pencahayaan merata tanpa bayangan.</li>
            <li>• Pastikan <b>4 kotak hitam sudut</b> dan kode QR terlihat utuh dalam bingkai.</li>
            <li>• Posisi boleh miring atau terbalik; sistem meluruskan otomatis.</li>
          </ul>
        </Card>

        <div className="min-w-0">
          {problem && (
            <Card className="mb-4 flex items-start gap-3 p-4"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose" /><div><p className="font-bold">Foto belum bisa diproses</p><p className="mt-0.5 text-sm text-ink-900/70">{problem}</p></div></Card>
          )}
          {pending && <ManualPick page={pending} onPick={async (id) => { setBusy(true); try { const s = await loadSheet(id); if (!s) throw new Error('LJK tidak ditemukan'); await finish(pending, s, true) } catch (e) { setProblem(errMsg(e)) } finally { setBusy(false) } }} onCancel={() => setPending(null)} />}
          {review && <ReviewPanel review={review} setAnswers={(a) => setReview({ ...review, answers: a })} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setReview(null)} />}
          {!review && !pending && !problem && <Card><EmptyState title="Menunggu foto LJK" text="Hasil pembacaan akan muncul di sini untuk diperiksa sebelum disimpan." icon={<Camera className="h-6 w-6" />} /></Card>}
        </div>
      </div>
    </>
  )
}

/* ───────── Pilih LJK manual bila QR tidak terbaca ───────── */
function ManualPick({ onPick, onCancel }: { page: Gray; onPick: (sheetId: string) => void; onCancel: () => void }) {
  const [examId, setExamId] = useState('')
  const [sheetId, setSheetId] = useState('')
  const exams = useQuery({ queryKey: ['scan', 'exams'], queryFn: async () => { const { data, error } = await supabase.from('exams').select('id,title,exam_date').order('exam_date', { ascending: false }); if (error) throw error; return data as { id: string; title: string }[] } })
  const sheets = useQuery({
    queryKey: ['scan', 'sheets', examId], enabled: !!examId,
    queryFn: async () => { const { data, error } = await supabase.from('ljk_sheets').select('id,status,student:students(nis,full_name)').eq('exam_id', examId); if (error) throw error; return (data as unknown as { id: string; status: string; student: { nis: string; full_name: string } }[]).sort((a, b) => a.student.full_name.localeCompare(b.student.full_name)) },
  })
  return (
    <Card className="mb-4 p-5">
      <p className="font-extrabold">Kode QR tidak terbaca</p>
      <p className="mb-4 mt-0.5 text-sm text-ink-900/60">Penanda sudut terdeteksi, tetapi QR tidak. Pilih LJK secara manual dengan mencocokkan nama pada lembar.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ujian"><Select value={examId} onChange={(e) => { setExamId(e.target.value); setSheetId('') }}><option value="">Pilih ujian…</option>{exams.data?.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Select></Field>
        <Field label="Siswa"><Select value={sheetId} onChange={(e) => setSheetId(e.target.value)} disabled={!examId}><option value="">Pilih siswa…</option>{sheets.data?.map((s) => <option key={s.id} value={s.id}>{s.student.full_name} ({s.student.nis}){s.status === 'discan' ? ' ✓' : ''}</option>)}</Select></Field>
      </div>
      <div className="mt-4 flex gap-2"><Button disabled={!sheetId} onClick={() => onPick(sheetId)}>Lanjutkan</Button><Button variant="outline" onClick={onCancel}>Batal</Button></div>
    </Card>
  )
}

/* ───────── Panel tinjau hasil ───────── */
function ReviewPanel({ review, setAnswers, saving, onSave, onDiscard }: { review: Review; setAnswers: (a: string) => void; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  const { sheet, key, answers, page } = review
  const ex = sheet.exam
  const letters = OPTION_LETTERS.slice(0, ex.option_count)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prev = useMemo(() => (key ? previewScore(answers, key) : null), [answers, key])
  const flagged = useMemo(() => [...answers].map((a, i) => (a === '-' || a === '*' ? i : -1)).filter((i) => i >= 0), [answers])

  // Gambar halaman lurus + tandai jawaban terbaca
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    grayToCanvas(page, c)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 3
    for (let q = 0; q < ex.question_count; q++) {
      const a = answers[q]
      const idx = OPTION_LETTERS.indexOf(a as (typeof OPTION_LETTERS)[number])
      const ok = key && (key[q] === '-' || key[q] === a)
      if (idx >= 0) {
        const p = bubbleCenter(q, idx)
        ctx.strokeStyle = !key ? '#5B4FD1' : ok ? '#22A06B' : '#E8505B'
        ctx.beginPath(); ctx.arc(p.x * PX_PER_MM, p.y * PX_PER_MM, (GRID.bubbleD / 2 + 0.9) * PX_PER_MM, 0, Math.PI * 2); ctx.stroke()
        if (key && !ok && key[q] !== '-') {
          const kp = bubbleCenter(q, OPTION_LETTERS.indexOf(key[q] as (typeof OPTION_LETTERS)[number]))
          ctx.strokeStyle = '#22A06B'; ctx.setLineDash([4, 3])
          ctx.beginPath(); ctx.arc(kp.x * PX_PER_MM, kp.y * PX_PER_MM, (GRID.bubbleD / 2 + 0.9) * PX_PER_MM, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
        }
      } else {
        const p0 = bubbleCenter(q, 0), p1 = bubbleCenter(q, ex.option_count - 1)
        ctx.strokeStyle = '#F2B134'
        ctx.strokeRect((p0.x - 3.2) * PX_PER_MM, (p0.y - 3.2) * PX_PER_MM, (p1.x - p0.x + 6.4) * PX_PER_MM, 6.4 * PX_PER_MM)
      }
    }
  }, [page, answers, key, ex.question_count, ex.option_count])

  const setAt = (i: number, ch: string) => setAnswers(answers.slice(0, i) + ch + answers.slice(i + 1))

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-900/50">{ex.title} • {ex.class?.name}</p>
          <h2 className="text-xl font-extrabold">{sheet.student.full_name}</h2>
          <p className="text-sm text-ink-900/60">NIS {sheet.student.nis} • Paket {sheet.paket}{review.manual && ' • dipilih manual'}</p>
        </div>
        {prev && (
          <div className="rounded-2xl bg-ink-900 px-5 py-3 text-center text-white">
            <p className="text-3xl font-extrabold leading-none">{fmtNum(prev.score)}</p>
            <p className="mt-1 text-[11px] text-white/70">{prev.correct} benar • {prev.wrong} salah • {prev.blank} kosong</p>
          </div>
        )}
      </div>

      {sheet.status === 'discan' && <p role="status" className="mt-3 rounded-xl bg-sun-soft px-3 py-2 text-xs font-semibold text-sun-ink">LJK ini sudah pernah discan (nilai {fmtNum(sheet.score)}). Menyimpan akan menimpa hasil sebelumnya.</p>}
      {!key && <p role="alert" className="mt-3 rounded-xl bg-rose-soft px-3 py-2 text-xs font-semibold text-rose-ink">Kunci jawaban paket {sheet.paket} belum diatur — atur dulu di Jadwal Ujian agar bisa disimpan.</p>}
      {flagged.length > 0 && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-sun-ink"><TriangleAlert className="h-4 w-4" />{flagged.length} nomor kosong/ganda (kotak kuning): periksa pada gambar dan koreksi bila perlu.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
        <div className="max-h-[560px] overflow-auto rounded-2xl border border-ink-100 bg-canvas p-1">
          <canvas ref={canvasRef} className="w-full rounded-xl" aria-label="Gambar LJK yang sudah diluruskan" />
        </div>
        <div className="max-h-[560px] overflow-y-auto pr-1">
          <div className="grid gap-1 sm:grid-cols-2">
            {Array.from({ length: ex.question_count }, (_, i) => {
              const a = answers[i]
              const bad = a === '-' || a === '*'
              const ok = key ? key[i] === '-' || key[i] === a : null
              return (
                <div key={i} className={cn('flex items-center gap-1.5 rounded-xl px-1.5 py-1', bad ? 'bg-sun-soft' : ok === false ? 'bg-rose-soft' : '')}>
                  <span className="w-6 text-right text-xs font-extrabold tabular-nums text-ink-900/50">{i + 1}</span>
                  <div role="radiogroup" aria-label={`Jawaban soal ${i + 1}`} className="flex gap-0.5">
                    {letters.map((l) => (
                      <button key={l} role="radio" aria-checked={a === l} onClick={() => setAt(i, l)}
                        className={cn('h-7 w-7 rounded-full border text-[11px] font-bold', a === l ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-100 bg-white text-ink-900/60 hover:border-primary')}>{l}</button>
                    ))}
                    <button role="radio" aria-checked={a === '-'} title="Kosong" onClick={() => setAt(i, '-')} className={cn('h-7 rounded-full border px-1.5 text-[10px] font-bold', a === '-' ? 'border-sun bg-sun text-white' : 'border-ink-100 bg-white text-ink-900/40')}>kosong</button>
                  </div>
                  {a === '*' && <Badge tone="amber">ganda</Badge>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100/60 pt-4">
        <p className="flex items-center gap-1.5 text-xs text-ink-900/55"><CheckCircle2 className="h-4 w-4 text-mint" />Hijau = benar, merah = salah (garis putus = kunci), kuning = kosong/ganda.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDiscard}><RefreshCw className="h-4 w-4" />Scan ulang</Button>
          <Button onClick={onSave} loading={saving} disabled={!key || answers.includes('*')} title={answers.includes('*') ? 'Selesaikan nomor ganda dulu' : undefined}><Save className="h-4 w-4" />Simpan nilai</Button>
        </div>
      </div>
    </Card>
  )
}
