export const cn = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ')

export const fmtDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export const fmtDateShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')

export const fmtNum = (n: number | null | undefined, d = 1) =>
  n == null ? '–' : n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 })

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function greeting(): string {
  const h = new Date().getHours()
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'
}

/** Escape field CSV + BOM agar Excel membaca UTF-8. */
export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export const errMsg = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = String((e as { message: unknown }).message)
    if (/duplicate key.*nis/i.test(m)) return 'NIS sudah terdaftar'
    if (/duplicate key.*code/i.test(m)) return 'Kode sudah digunakan'
    if (/duplicate key.*name/i.test(m)) return 'Nama sudah digunakan'
    if (/duplicate key.*nip/i.test(m)) return 'NIP sudah terdaftar'
    if (/violates foreign key.*restrict|still referenced/i.test(m)) return 'Data masih dipakai di data lain sehingga tidak bisa dihapus'
    return m
  }
  return 'Terjadi kesalahan'
}
