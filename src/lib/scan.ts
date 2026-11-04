/** Jembatan browser (canvas, jsQR) ke mesin OMR murni. */
import jsQR from 'jsqr'
import { PX_PER_MM, processPage, rgbaToGray, sampleBilinear, type Gray, type PageResult } from './omr/omr.ts'
import { QR_PREFIX } from './omr/layout.ts'

export function sourceToGray(src: CanvasImageSource, width: number, height: number, maxW = 1600): Gray {
  const k = width > maxW ? maxW / width : 1
  const w = Math.round(width * k)
  const h = Math.round(height * k)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas tidak tersedia')
  ctx.drawImage(src, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  return rgbaToGray(img.data, w, h)
}

function upscale(g: Gray, f: number): Gray {
  const w = Math.round(g.width * f)
  const h = Math.round(g.height * f)
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = sampleBilinear(g, (x + 0.5) / f - 0.5, (y + 0.5) / f - 0.5)
  return { data: out, width: w, height: h }
}

/** Decode QR dari potongan gambar abu-abu. Mengembalikan teks QR atau null. */
export function decodeQr(g: Gray): string | null {
  for (const f of [2, 1]) {
    const s = f === 1 ? g : upscale(g, f)
    const rgba = new Uint8ClampedArray(s.width * s.height * 4)
    for (let i = 0, j = 0; i < s.data.length; i++, j += 4) { rgba[j] = rgba[j + 1] = rgba[j + 2] = s.data[i]; rgba[j + 3] = 255 }
    const r = jsQR(rgba, s.width, s.height, { inversionAttempts: 'dontInvert' })
    if (r?.data) return r.data
  }
  return null
}

export function processImage(gray: Gray): PageResult {
  return processPage(gray, decodeQr)
}

export function sheetIdFromPayload(payload: string | null): string | null {
  return payload && payload.startsWith(QR_PREFIX) ? payload.slice(QR_PREFIX.length) : null
}

export function grayToCanvas(g: Gray, canvas: HTMLCanvasElement) {
  canvas.width = g.width
  canvas.height = g.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(g.width, g.height)
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) { img.data[j] = img.data[j + 1] = img.data[j + 2] = g.data[i]; img.data[j + 3] = 255 }
  ctx.putImageData(img, 0, 0)
}

/** Skor lokal (cermin SQL compute_score) hanya untuk pratinjau; nilai resmi dihitung server saat simpan. */
export function previewScore(answers: string, key: string) {
  let correct = 0, wrong = 0, blank = 0
  for (let i = 0; i < key.length; i++) {
    const a = answers[i], k = key[i]
    if (k === '-') correct++
    else if (a === '-') blank++
    else if (a === k) correct++
    else wrong++
  }
  return { correct, wrong, blank, score: key.length ? Math.round((correct / key.length) * 10000) / 100 : 0 }
}

export { PX_PER_MM }
