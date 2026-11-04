/**
 * Uji mandiri mesin OMR dengan gambar sintetis (tanpa kamera/kanvas):
 * perspektif, rotasi 0/90/180/270, gradasi cahaya, noise, isian ganda & kosong.
 * Jalankan: node scripts/omr-selftest.ts
 */
import assert from 'node:assert/strict'
import { GRID, MARKER_CENTERS, MARKER_SIZE, PAGE_H, PAGE_W, QR_BOX, bubbleCenter, type Pt } from '../src/lib/omr/layout.ts'
import { applyH, processPage, readAnswers, sampleBilinear, solveHomography, type Gray } from '../src/lib/omr/omr.ts'

const S = 8 // px/mm untuk "kertas asli"
function renderPaper(answers: string, optionCount: number): Gray {
  const W = PAGE_W * S
  const H = PAGE_H * S
  const data = new Uint8ClampedArray(W * H).fill(250)
  const disc = (cx: number, cy: number, r0: number, r1: number, v: number) => {
    for (let y = Math.floor((cy - r1) * S); y <= Math.ceil((cy + r1) * S); y++)
      for (let x = Math.floor((cx - r1) * S); x <= Math.ceil((cx + r1) * S); x++) {
        const d = Math.hypot((x + 0.5) / S - cx, (y + 0.5) / S - cy)
        if (d >= r0 && d <= r1 && x >= 0 && y >= 0 && x < W && y < H) data[y * W + x] = v
      }
  }
  const rect = (x0: number, y0: number, w: number, h: number, v: number) => {
    for (let y = Math.round(y0 * S); y < Math.round((y0 + h) * S); y++)
      for (let x = Math.round(x0 * S); x < Math.round((x0 + w) * S); x++) data[y * W + x] = v
  }
  for (const c of Object.values(MARKER_CENTERS)) rect(c.x - MARKER_SIZE / 2, c.y - MARKER_SIZE / 2, MARKER_SIZE, MARKER_SIZE, 20)
  rect(QR_BOX.x, QR_BOX.y, QR_BOX.size, QR_BOX.size, 30) // pengganti QR
  rect(30, 30, 60, 6, 60) // "teks" header
  const r = GRID.bubbleD / 2
  for (let q = 0; q < answers.length; q++) {
    for (let i = 0; i < optionCount; i++) {
      const c = bubbleCenter(q, i)
      disc(c.x, c.y, r - 0.15, r + 0.15, 40) // cincin cetak
    }
    const a = answers[q]
    const fill = (i: number, v: number) => {
      const c = bubbleCenter(q, i)
      disc(c.x + 0.2, c.y - 0.15, 0, r * 0.95, v)
    }
    if (a === '*') { fill(1, 70); fill(2, 60) }
    else if (a !== '-') fill('ABCDE'.indexOf(a), 55)
  }
  return { data, width: W, height: H }
}

function scene(paper: Gray, dest: Pt[], w: number, h: number): Gray {
  const page: Pt[] = [{ x: 0, y: 0 }, { x: PAGE_W, y: 0 }, { x: PAGE_W, y: PAGE_H }, { x: 0, y: PAGE_H }]
  const inv = solveHomography(dest, page)
  const data = new Uint8ClampedArray(w * h)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = applyH(inv, x + 0.5, y + 0.5)
      let v = 95 // meja
      if (p.x >= 0 && p.y >= 0 && p.x < PAGE_W && p.y < PAGE_H) v = sampleBilinear(paper, p.x * S, p.y * S)
      v = v * (0.72 + 0.28 * (x / w)) + rnd() * 14 // gradasi cahaya + noise
      data[y * w + x] = v
    }
  return { data, width: w, height: h }
}

const N = 50
const letters = 'ABCDE'
let answers = ''
for (let q = 0; q < N; q++) answers += q % 11 === 3 ? '-' : q % 17 === 5 ? '*' : letters[(q * 7 + 3) % 5]

const paper = renderPaper(answers, 5)
const decode = (g: Gray) => {
  let sum = 0
  for (const v of g.data) sum += v
  return sum / g.data.length < 200 ? 'LJK1:test' : null // QR "ada" bila area gelap
}
const base: Pt[] = [{ x: 170, y: 130 }, { x: 1190, y: 175 }, { x: 1235, y: 1600 }, { x: 115, y: 1650 }]
const CX = 900
const CY = 900
for (const rot of [0, 1, 2, 3]) {
  // putar segi empat foto di sekitar pusat kanvas persegi (rotasi fisik nyata)
  const a = (rot * Math.PI) / 2
  const dest = base.map((p) => {
    const dx = p.x - 675
    const dy = p.y - 890
    return { x: CX + dx * Math.cos(a) - dy * Math.sin(a), y: CY + dx * Math.sin(a) + dy * Math.cos(a) }
  })
  const img = scene(paper, dest, 1800, 1800)
  const t0 = Date.now()
  const res = processPage(img, decode)
  assert.ok(res.ok, `rotasi ${rot}: halaman gagal diproses`)
  if (!res.ok) throw new Error()
  assert.equal(res.payload, 'LJK1:test', `rotasi ${rot}: QR tidak terbaca`)
  const read = readAnswers(res.page, N, 5)
  let bad = 0
  for (let q = 0; q < N; q++) if (read.answers[q] !== answers[q]) bad++
  assert.equal(bad, 0, `rotasi ${rot}: ${bad} soal salah baca\n exp ${answers}\n got ${read.answers}`)
  console.log(`OK rotasi ${rot * 90}° — ${N} soal terbaca benar (${Date.now() - t0} ms)`)
}
console.log('Semua uji OMR lulus.')
