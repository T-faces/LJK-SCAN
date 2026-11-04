/**
 * Template LJK (A4 portrait, satuan milimeter).
 * File ini dipakai BERSAMA oleh halaman cetak dan mesin pemindai (OMR)
 * sehingga posisi gelembung yang dicetak selalu sama dengan yang dibaca.
 */
export interface Pt {
  x: number
  y: number
}

export const PAGE_W = 210
export const PAGE_H = 297

/** Penanda sudut: kotak hitam 8 mm. Nilai = titik tengah kotak. */
export const MARKER_SIZE = 8
export const MARKER_CENTERS = {
  tl: { x: 14, y: 14 },
  tr: { x: 196, y: 14 },
  bl: { x: 14, y: 283 },
  br: { x: 196, y: 283 },
} as const

/** Kotak QR (berisi ID lembar LJK). */
export const QR_BOX = { x: 158, y: 20, size: 32 }

export const MAX_QUESTIONS = 60
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

export const GRID = {
  top: 118,
  rowPitch: 7.4,
  rowsPerCol: 20,
  colX0: 22,
  colPitch: 58,
  numW: 8,
  optPitch: 7.4,
  bubbleD: 4.8,
} as const

/** Payload QR: "LJK1:<uuid lembar>" */
export const QR_PREFIX = 'LJK1:'

/** Titik tengah gelembung soal ke-q (0-based), opsi ke-opt (0-based). */
export function bubbleCenter(q: number, opt: number): Pt {
  const col = Math.floor(q / GRID.rowsPerCol)
  const row = q % GRID.rowsPerCol
  return {
    x: GRID.colX0 + col * GRID.colPitch + GRID.numW + GRID.bubbleD / 2 + opt * GRID.optPitch,
    y: GRID.top + row * GRID.rowPitch + GRID.bubbleD / 2,
  }
}

export function columnCount(questionCount: number): number {
  return Math.ceil(questionCount / GRID.rowsPerCol)
}
