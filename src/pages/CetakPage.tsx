import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logoUrl, useSchool } from '@/lib/hooks'
import { GRID, MARKER_CENTERS, MARKER_SIZE, OPTION_LETTERS, PAGE_H, PAGE_W, QR_BOX, QR_PREFIX, bubbleCenter } from '@/lib/omr/layout'
import { fmtDate } from '@/lib/utils'
import type { Exam, Sheet } from '@/lib/types'
import { Button, Card, ErrorState, Spinner } from '@/components/ui'

const mm = (v: number) => `${v}mm`
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: mm(x), top: mm(y), ...(w !== undefined ? { width: mm(w) } : {}), ...(h !== undefined ? { height: mm(h) } : {}) })

export default function CetakPage() {
  const { examId = '' } = useParams()
  const [sp] = useSearchParams()
  const only = sp.get('sheet')
  const { data: school } = useSchool()
  const [qr, setQr] = useState<Record<string, string>>({})

  const exam = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exams').select('*, subject:subjects(code,name), class:classes(name)').eq('id', examId).single()
      if (error) throw error
      return data as unknown as Exam
    },
  })
  const sheets = useQuery({
    queryKey: ['sheets', examId, 'print'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ljk_sheets').select('*, student:students(nis,full_name)').eq('exam_id', examId)
      if (error) throw error
      return ((data ?? []) as unknown as Sheet[]).sort((a, b) => (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? ''))
    },
  })

  const list = useMemo(() => (sheets.data ?? []).filter((s) => !only || s.id === only), [sheets.data, only])

  useEffect(() => {
    let alive = true
    void (async () => {
      const out: Record<string, string> = {}
      for (const s of list) out[s.id] = await QRCode.toDataURL(QR_PREFIX + s.id, { errorCorrectionLevel: 'M', margin: 0, width: 480 })
      if (alive) setQr(out)
    })()
    return () => { alive = false }
  }, [list])

  if (exam.isLoading || sheets.isLoading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>
  if (exam.error || sheets.error) return <div className="p-6"><Card><ErrorState error={exam.error ?? sheets.error} /></Card></div>
  const e = exam.data!
  const ready = list.length > 0 && list.every((s) => qr[s.id])
  const logo = logoUrl(school?.logo_path)

  return (
    <div className="min-h-screen bg-ink-100/60 pb-10 print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-20 border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={`/jadwal/${examId}`} aria-label="Kembali" className="rounded-xl p-2 hover:bg-canvas"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="leading-tight"><p className="font-extrabold">{e.title}</p><p className="text-xs text-ink-900/60">{list.length} lembar LJK • {e.class?.name}</p></div>
          </div>
          <Button onClick={() => window.print()} disabled={!ready}><Printer className="h-4 w-4" />Cetak{!ready && list.length > 0 ? ' (menyiapkan QR…)' : ''}</Button>
        </div>
        <p className="mx-auto mt-2 max-w-4xl text-xs text-ink-900/60">Cetak di kertas <b>A4</b>, skala <b>100% / Actual size</b> (bukan “Fit to page”), margin <b>None</b>, matikan header &amp; footer browser. Tinta hitam pekat agar penanda sudut terbaca.</p>
      </div>

      {list.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md"><Card className="p-8 text-center"><p className="font-bold">Belum ada LJK untuk dicetak</p><p className="mt-1 text-sm text-ink-900/60">Buat LJK siswa di tab “LJK Siswa” terlebih dahulu.</p></Card></div>
      ) : (
        <div className="overflow-x-auto px-2 pt-6 print:overflow-visible print:p-0">
          {list.map((s) => (
            <section key={s.id} className="sheet relative mx-auto mb-6 bg-white shadow-card" style={{ width: mm(PAGE_W), height: mm(PAGE_H), color: '#000', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' }} aria-label={`LJK ${s.student?.full_name}`}>
              {/* Penanda sudut */}
              {Object.values(MARKER_CENTERS).map((c, i) => <div key={i} style={{ ...abs(c.x - MARKER_SIZE / 2, c.y - MARKER_SIZE / 2, MARKER_SIZE, MARKER_SIZE), background: '#000' }} />)}

              {/* Kop */}
              {logo && <img src={logo} alt="" style={{ ...abs(24, 12, 14, 14), objectFit: 'contain' }} />}
              <div style={{ ...abs(logo ? 41 : 24, 12, 112), lineHeight: 1.15 }}>
                <div style={{ fontSize: '4.4mm', fontWeight: 700 }}>{school?.school_name}</div>
                <div style={{ fontSize: '2.9mm' }}>LEMBAR JAWABAN KOMPUTER (LJK)</div>
                <div style={{ fontSize: '2.9mm' }}>{e.title}</div>
              </div>

              {/* Identitas */}
              <div style={{ ...abs(24, 34, 128), fontSize: '3.2mm', lineHeight: 1 }}>
                {[['Nama', s.student?.full_name], ['NIS', s.student?.nis], ['Kelas', e.class?.name], ['Mapel', e.subject?.name], ['Tanggal', fmtDate(e.exam_date)]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'flex-end', height: mm(7.4) }}>
                    <span style={{ width: mm(18), fontWeight: 700 }}>{k}</span>
                    <span style={{ flex: 1, borderBottom: '0.25mm solid #000', paddingBottom: '0.6mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* QR + paket */}
              <img src={qr[s.id]} alt="" style={{ ...abs(QR_BOX.x, QR_BOX.y, QR_BOX.size, QR_BOX.size), imageRendering: 'pixelated' }} />
              <div style={{ ...abs(QR_BOX.x, QR_BOX.y + QR_BOX.size + 1.5, QR_BOX.size), fontSize: '2.2mm', textAlign: 'center', fontFamily: 'monospace' }}>{s.id.slice(0, 8)}</div>
              {e.pakets.length > 1 && <div style={{ ...abs(QR_BOX.x, 60, QR_BOX.size, 9), border: '0.5mm solid #000', fontSize: '4.2mm', fontWeight: 700, textAlign: 'center', lineHeight: '8mm' }}>PAKET {s.paket}</div>}

              {/* Petunjuk */}
              <div style={{ ...abs(24, 84, 163, 24), border: '0.25mm solid #000', padding: '1.6mm 2.4mm', fontSize: '2.7mm', lineHeight: 1.35, boxSizing: 'border-box' }}>
                <b>PETUNJUK PENGISIAN</b>
                <div>1. Gunakan pensil 2B atau pulpen hitam. 2. Hitamkan bulatan jawaban secara penuh, satu pilihan per nomor.</div>
                <div>3. Bila salah, hapus sampai bersih (pensil). 4. Jangan melipat, mencoret, atau menutupi kotak hitam di sudut dan kode QR.</div>
                <div style={{ marginTop: '1mm', display: 'flex', alignItems: 'center', gap: '2mm' }}>Contoh benar: <Dot filled /> &nbsp; salah: <Dot x /> <Dot half /></div>
              </div>

              {/* Kolom huruf */}
              {Array.from({ length: Math.ceil(e.question_count / GRID.rowsPerCol) }, (_, col) =>
                OPTION_LETTERS.slice(0, e.option_count).map((L, i) => {
                  const c = bubbleCenter(col * GRID.rowsPerCol, i)
                  return <div key={`${col}${L}`} style={{ ...abs(c.x - 2, GRID.top - 5.2, 4, 4), fontSize: '3mm', fontWeight: 700, textAlign: 'center' }}>{L}</div>
                }),
              )}

              {/* Nomor + gelembung */}
              {Array.from({ length: e.question_count }, (_, q) => {
                const first = bubbleCenter(q, 0)
                return (
                  <div key={q}>
                    <div style={{ ...abs(first.x - GRID.bubbleD / 2 - GRID.numW + 1, first.y - 2, GRID.numW - 2.2, 4), fontSize: '3.1mm', fontWeight: 700, textAlign: 'right', lineHeight: '4mm' }}>{q + 1}</div>
                    {Array.from({ length: e.option_count }, (_, i) => {
                      const c = bubbleCenter(q, i)
                      return <div key={i} style={{ ...abs(c.x - GRID.bubbleD / 2, c.y - GRID.bubbleD / 2, GRID.bubbleD, GRID.bubbleD), border: '0.3mm solid #222', borderRadius: '50%', boxSizing: 'border-box' }} />
                    })}
                  </div>
                )
              })}

              <div style={{ ...abs(24, 289, 150), fontSize: '2.3mm', color: '#444' }}>{school?.school_name} • TA {school?.academic_year} {school?.semester}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Dot({ filled, x, half }: { filled?: boolean; x?: boolean; half?: boolean }) {
  return (
    <span style={{ display: 'inline-block', width: mm(3.6), height: mm(3.6), border: '0.3mm solid #222', borderRadius: '50%', boxSizing: 'border-box', verticalAlign: 'middle', position: 'relative', background: filled ? '#000' : half ? 'linear-gradient(90deg,#000 50%,#fff 50%)' : '#fff' }}>
      {x && <span style={{ position: 'absolute', inset: 0, fontSize: '3mm', lineHeight: '3mm', textAlign: 'center', fontWeight: 700 }}>×</span>}
    </span>
  )
}
