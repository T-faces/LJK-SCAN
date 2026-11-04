import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ───────── Button ───────── */
type Variant = 'primary' | 'dark' | 'soft' | 'outline' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90 shadow-sm',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 shadow-sm',
  soft: 'bg-primary-soft text-primary hover:bg-primary/15',
  outline: 'border border-ink-100 bg-white text-ink-900 hover:bg-canvas',
  ghost: 'text-ink-900/70 hover:bg-ink-100/60',
  danger: 'bg-rose text-white hover:bg-rose/90',
}
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-9 px-3 text-xs',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'icon' && 'h-9 w-9',
        variants[variant], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

/* ───────── Form controls ───────── */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-900/50">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-rose-ink">{error}</p>}
    </div>
  )
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn('input', className)} {...p} />
})
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cn('input pr-8', className)} {...p}>{children}</select>
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn('input h-auto min-h-24 py-2.5', className)} {...p} />
})
export function SearchInput({ value, onChange, placeholder = 'Cari…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/40" aria-hidden />
      <input className="input pl-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  )
}

/* ───────── Display ───────── */
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cn('card', className)}>{children}</div>

const tones = {
  indigo: 'bg-primary-soft text-primary', amber: 'bg-sun-soft text-sun-ink', cyan: 'bg-sky-soft text-sky-ink',
  rose: 'bg-rose-soft text-rose-ink', green: 'bg-mint-soft text-mint-ink', dark: 'bg-ink-900 text-white', gray: 'bg-ink-100/70 text-ink-900/70',
}
export type Tone = keyof typeof tones
export const Badge = ({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold leading-none', tones[tone], className)}>{children}</span>
)

export function ProgressBar({ value, color = 'bg-primary', label }: { value: number; color?: string; label: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100/70">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${v}%` }} />
    </div>
  )
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} aria-label="Memuat" />
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-xl bg-ink-100/70', className)} aria-hidden />

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-900/60">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Gagal memuat data'
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <AlertTriangle className="mb-2 h-8 w-8 text-rose" />
      <p className="font-bold">Data gagal dimuat</p>
      <p className="mt-1 max-w-md text-sm text-ink-900/60">{msg}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Coba lagi</Button>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-900/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ───────── Table + pagination ───────── */
export const TableWrap = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>
)
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th scope="col" className={cn('whitespace-nowrap bg-canvas/70 px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-900/55 first:rounded-l-xl last:rounded-r-xl', className)}>{children}</th>
)
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn('border-b border-ink-100/60 px-4 py-3 align-middle', className)}>{children}</td>
)

export function usePaged<T>(items: T[], size = 10) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / size))
  const safe = Math.min(page, pages)
  const slice = useMemo(() => items.slice((safe - 1) * size, safe * size), [items, safe, size])
  return { slice, page: safe, pages, setPage, total: items.length, size }
}
export function Pager({ page, pages, setPage, total, size }: ReturnType<typeof usePaged>) {
  if (total <= size) return null
  const from = (page - 1) * size + 1
  const to = Math.min(total, page * size)
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-ink-900/60">
      <span>{from}–{to} dari {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2 font-semibold">{page}/{pages}</span>
        <Button variant="outline" size="icon" aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

/* ───────── Tabs ───────── */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-2xl bg-white p-1 shadow-card">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}
          className={cn('rounded-xl px-4 py-2 text-sm font-semibold transition', value === it.value ? 'bg-ink-900 text-white' : 'text-ink-900/60 hover:bg-canvas')}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ───────── Modal ───────── */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus() }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id}
        className={cn('flex max-h-[92vh] w-full flex-col rounded-t-4xl bg-white shadow-pop sm:rounded-4xl', size === 'sm' && 'sm:max-w-sm', size === 'md' && 'sm:max-w-lg', size === 'lg' && 'sm:max-w-3xl')}>
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 id={id} className="text-lg font-extrabold">{title}</h2>
          <button data-close aria-label="Tutup" onClick={onClose} className="rounded-xl p-2 text-ink-900/50 hover:bg-canvas"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, text, confirmLabel = 'Hapus', loading, onConfirm, onClose }: {
  open: boolean; title: string; text: string; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Batal</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-ink-900/70">{text}</p>
    </Modal>
  )
}

/* ───────── Toast ───────── */
interface ToastItem { id: number; kind: 'success' | 'error'; text: string }
const ToastCtx = createContext<{ success: (t: string) => void; error: (t: string) => void } | null>(null)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  const api = useMemo(() => ({ success: (t: string) => push('success', t), error: (t: string) => push('error', t) }), [push])
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-pop">
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export function useToast() {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast harus di dalam ToastProvider')
  return v
}
