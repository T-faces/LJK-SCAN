export interface Slice { label: string; value: number; color: string }

/** Donat SVG sederhana tanpa library. */
export function Donut({ slices, centerTop, centerBottom, size = 200 }: { slices: Slice[]; centerTop: string; centerBottom: string; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0
  const desc = slices.map((s) => `${s.label}: ${s.value}`).join(', ')
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Sebaran nilai. ${desc}`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="13" />
      {total > 0 && slices.map((s) => {
        if (s.value === 0) return null
        const len = (s.value / total) * C
        const el = (
          <circle key={s.label} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="13"
            strokeDasharray={`${Math.max(0, len - (slices.filter((x) => x.value > 0).length > 1 ? 0.8 : 0))} ${C}`}
            strokeDashoffset={-offset} transform="rotate(-90 50 50)" />
        )
        offset += len
        return el
      })}
      <circle cx="50" cy="50" r="30" fill="#fff" />
      <text x="50" y="52" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1E1A5C">{centerTop}</text>
      <text x="50" y="62" textAnchor="middle" fontSize="5" fontWeight="700" fill="#E8505B">{centerBottom}</text>
    </svg>
  )
}
