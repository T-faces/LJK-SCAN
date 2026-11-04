/**
 * Mesin OMR (Optical Mark Recognition) murni TypeScript — tanpa dependensi.
 * Alur: gambar abu-abu → cari 4 penanda sudut → luruskan (homografi) ke
 * kanvas A4 4 px/mm → decode QR → baca gelembung per soal.
 */
import { GRID, MARKER_CENTERS, PAGE_H, PAGE_W, QR_BOX, OPTION_LETTERS, bubbleCenter, type Pt } from './layout.ts'

export interface Gray {
  data: Uint8ClampedArray
  width: number
  height: number
}
export interface Corners {
  tl: Pt
  tr: Pt
  br: Pt
  bl: Pt
}

export const PX_PER_MM = 4
/** Gelembung dianggap terisi jika tingkat kegelapan relatif >= nilai ini. */
export const MARK_THRESHOLD = 0.22

export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000
  }
  return { data, width, height }
}

export function sampleBilinear(g: Gray, x: number, y: number): number {
  const { width: w, height: h, data } = g
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x > w - 1) x = w - 1
  if (y > h - 1) y = h - 1
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const a = data[y0 * w + x0] * (1 - fx) + data[y0 * w + x1] * fx
  const b = data[y1 * w + x0] * (1 - fx) + data[y1 * w + x1] * fx
  return a * (1 - fy) + b * fy
}

/** Perkecil dengan rata-rata blok (anti-aliasing). */
export function resizeGray(g: Gray, newW: number): Gray {
  const newH = Math.max(1, Math.round((g.height * newW) / g.width))
  const out = new Uint8ClampedArray(newW * newH)
  const sx = g.width / newW
  const sy = g.height / newH
  for (let y = 0; y < newH; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.min(g.height, Math.floor((y + 1) * sy)))
    for (let x = 0; x < newW; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.min(g.width, Math.floor((x + 1) * sx)))
      let sum = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          sum += g.data[yy * g.width + xx]
          n++
        }
      }
      out[y * newW + x] = sum / n
    }
  }
  return { data: out, width: newW, height: newH }
}

/** Binarisasi adaptif (integral image): 1 = gelap relatif terhadap sekitarnya. */
export function binarizeAdaptive(g: Gray, radius: number, ratio: number): Uint8Array {
  const { width: w, height: h, data } = g
  const W1 = w + 1
  const integral = new Float64Array(W1 * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += data[y * w + x]
      integral[(y + 1) * W1 + x + 1] = integral[y * W1 + x + 1] + row
    }
  }
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(h, y + radius + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w, x + radius + 1)
      const sum = integral[y1 * W1 + x1] - integral[y0 * W1 + x1] - integral[y1 * W1 + x0] + integral[y0 * W1 + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      out[y * w + x] = data[y * w + x] < mean * ratio ? 1 : 0
    }
  }
  return out
}

interface Blob {
  area: number
  cx: number
  cy: number
  solidity: number
  elong: number
}

function findBlobs(bin: Uint8Array, w: number, h: number): Blob[] {
  const seen = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  const blobs: Blob[] = []
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || seen[start]) continue
    let sp = 0
    stack[sp++] = start
    seen[start] = 1
    let area = 0
    let sx = 0
    let sy = 0
    let sxx = 0
    let syy = 0
    let sxy = 0
    while (sp > 0) {
      const p = stack[--sp]
      const x = p % w
      const y = (p - x) / w
      area++
      sx += x
      sy += y
      sxx += x * x
      syy += y * y
      sxy += x * y
      if (x > 0 && bin[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1 }
      if (x < w - 1 && bin[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1 }
      if (y > 0 && bin[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w }
      if (y < h - 1 && bin[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w }
    }
    if (area < 20) continue
    const cx = sx / area
    const cy = sy / area
    const vxx = sxx / area - cx * cx
    const vyy = syy / area - cy * cy
    const vxy = sxy / area - cx * cy
    const tr = vxx + vyy
    const det = vxx * vyy - vxy * vxy
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
    const l1 = tr / 2 + disc
    const l2 = Math.max(1e-6, tr / 2 - disc)
    // Persegi penuh: luas = 12*sqrt(l1*l2). Cincin/teks jauh di bawah 1.
    const solidity = area / (12 * Math.sqrt(l1 * l2))
    blobs.push({ area, cx, cy, solidity, elong: Math.sqrt(l1 / l2) })
  }
  return blobs
}

/**
 * Cari 4 penanda sudut. Hasil urut searah jarum jam [tl,tr,br,bl] menurut
 * posisi di GAMBAR (belum tentu sama dengan orientasi kertas).
 */
export function findMarkers(g: Gray): Pt[] | null {
  const TARGET_W = 900
  const s = g.width > TARGET_W ? resizeGray(g, TARGET_W) : g
  const k = g.width / s.width
  const bin = binarizeAdaptive(s, Math.round(s.width / 6), 0.7)
  const blobs = findBlobs(bin, s.width, s.height)
  const minA = (0.012 * s.width) ** 2 * 0.6
  const maxA = (0.09 * s.width) ** 2
  const cand = blobs.filter((b) => b.area >= minA && b.area <= maxA && b.solidity > 0.88 && b.solidity < 1.2 && b.elong < 1.7)
  if (cand.length < 4) return null
  const pick = (score: (b: Blob) => number) => cand.reduce((a, b) => (score(b) < score(a) ? b : a))
  const tl = pick((b) => b.cx + b.cy)
  const br = pick((b) => -(b.cx + b.cy))
  const tr = pick((b) => b.cy - b.cx)
  const bl = pick((b) => b.cx - b.cy)
  const four = [tl, tr, br, bl]
  if (new Set(four).size < 4) return null
  const areas = four.map((b) => b.area)
  if (Math.max(...areas) / Math.min(...areas) > 3) return null
  return four.map((b) => ({ x: (b.cx + 0.5) * k, y: (b.cy + 0.5) * k }))
}

/** Homografi 3x3 (h33 = 1) yang memetakan src[i] -> dst[i]. */
export function solveHomography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    const d = A[c][c]
    if (Math.abs(d) < 1e-12) throw new Error('Penanda sudut segaris')
    for (let j = c; j < 9; j++) A[c][j] /= d
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c]
      for (let j = c; j < 9; j++) A[r][j] -= f * A[c][j]
    }
  }
  return [A[0][8], A[1][8], A[2][8], A[3][8], A[4][8], A[5][8], A[6][8], A[7][8], 1]
}

export function applyH(H: number[], x: number, y: number): Pt {
  const w = H[6] * x + H[7] * y + H[8]
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w }
}

const TEMPLATE_CORNERS: Pt[] = [MARKER_CENTERS.tl, MARKER_CENTERS.tr, MARKER_CENTERS.br, MARKER_CENTERS.bl]

/** Luruskan halaman ke kanvas A4 (PX_PER_MM). `corners` = 4 titik gambar sesuai urutan template. */
export function warpToPage(g: Gray, corners: Pt[]): Gray {
  const H = solveHomography(TEMPLATE_CORNERS, corners) // mm -> gambar
  const W = Math.round(PAGE_W * PX_PER_MM)
  const Ht = Math.round(PAGE_H * PX_PER_MM)
  const out = new Uint8ClampedArray(W * Ht)
  for (let y = 0; y < Ht; y++) {
    for (let x = 0; x < W; x++) {
      const p = applyH(H, (x + 0.5) / PX_PER_MM, (y + 0.5) / PX_PER_MM)
      out[y * W + x] = sampleBilinear(g, p.x, p.y)
    }
  }
  return { data: out, width: W, height: Ht }
}

export function cropGray(g: Gray, x: number, y: number, w: number, h: number): Gray {
  const x0 = Math.max(0, Math.round(x))
  const y0 = Math.max(0, Math.round(y))
  const cw = Math.min(g.width - x0, Math.round(w))
  const ch = Math.min(g.height - y0, Math.round(h))
  const out = new Uint8ClampedArray(cw * ch)
  for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) out[yy * cw + xx] = g.data[(y0 + yy) * g.width + x0 + xx]
  return { data: out, width: cw, height: ch }
}

/** Area gambar (sudah lurus) tempat QR dicetak, diberi margin. */
export function qrRegion(page: Gray): Gray {
  const m = 4
  return cropGray(
    page,
    (QR_BOX.x - m) * PX_PER_MM,
    (QR_BOX.y - m) * PX_PER_MM,
    (QR_BOX.size + 2 * m) * PX_PER_MM,
    (QR_BOX.size + 2 * m) * PX_PER_MM,
  )
}

export type PageResult =
  | { ok: true; page: Gray; payload: string | null; rotation: number }
  | { ok: false; reason: string }

/**
 * Proses satu foto: temukan penanda, coba 4 rotasi, validasi lewat QR.
 * `decode` menerima potongan gambar area QR dan mengembalikan teks QR / null.
 */
export function processPage(gray: Gray, decode: (g: Gray) => string | null): PageResult {
  const found = findMarkers(gray)
  if (!found) {
    return { ok: false, reason: 'Empat penanda sudut hitam tidak terdeteksi. Pastikan seluruh lembar masuk bingkai, cukup terang, dan tidak terlipat.' }
  }
  const ideal = (PAGE_W - 28) / (PAGE_H - 28)
  const rots = [0, 1, 2, 3]
    .map((r) => {
      const pts = [0, 1, 2, 3].map((i) => found[(i + r) % 4])
      const top = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const left = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y)
      return { r, pts, penalty: Math.abs(Math.log(top / left / ideal)) }
    })
    .sort((a, b) => a.penalty - b.penalty)
  for (const cand of rots) {
    const page = warpToPage(gray, cand.pts)
    const payload = decode(qrRegion(page))
    if (payload) return { ok: true, page, payload, rotation: cand.r }
  }
  const best = rots[0]
  return { ok: true, page: warpToPage(gray, best.pts), payload: null, rotation: best.r }
}

function meanDisc(g: Gray, cx: number, cy: number, r: number): number {
  let sum = 0
  let n = 0
  const x0 = Math.floor(cx - r)
  const x1 = Math.ceil(cx + r)
  const y0 = Math.floor(cy - r)
  const y1 = Math.ceil(cy + r)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= g.width || y >= g.height) continue
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) {
        sum += g.data[y * g.width + x]
        n++
      }
    }
  }
  return n ? sum / n : 255
}

export interface ReadResult {
  /** Satu karakter per soal: A–E, '-' kosong, '*' ganda. */
  answers: string
  /** Kegelapan 0..1 untuk tiap [soal][opsi]. */
  darkness: number[][]
}

export function readAnswers(page: Gray, questionCount: number, optionCount: number): ReadResult {
  const rIn = (GRID.bubbleD / 2) * 0.62 * PX_PER_MM
  const rRef = 2
  let out = ''
  const darkness: number[][] = []
  for (let q = 0; q < questionCount; q++) {
    // Referensi kertas kosong = celah antar gelembung pada baris yang sama
    // (kebal terhadap pencahayaan tidak merata).
    let refSum = 0
    for (let i = 0; i < optionCount - 1; i++) {
      const a = bubbleCenter(q, i)
      refSum += meanDisc(page, (a.x + GRID.optPitch / 2) * PX_PER_MM, a.y * PX_PER_MM, rRef)
    }
    const ref = Math.max(60, refSum / (optionCount - 1))
    const d: number[] = []
    for (let i = 0; i < optionCount; i++) {
      const c = bubbleCenter(q, i)
      const m = meanDisc(page, c.x * PX_PER_MM, c.y * PX_PER_MM, rIn)
      d.push(Math.min(1, Math.max(0, 1 - m / ref)))
    }
    darkness.push(d)
    const top = Math.max(...d)
    if (top < MARK_THRESHOLD) {
      out += '-'
      continue
    }
    const filled = d.filter((v) => v >= Math.max(MARK_THRESHOLD, top * 0.6)).length
    out += filled > 1 ? '*' : OPTION_LETTERS[d.indexOf(top)]
  }
  return { answers: out, darkness }
}
