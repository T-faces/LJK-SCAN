import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ScanLine } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Button, Field, Input } from '@/components/ui'

const schema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const { session, loading } = useAuth()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  if (!loading && session) return <Navigate to="/" replace />

  const onSubmit = async (v: Form) => {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email atau kata sandi salah' : error.message)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-peach p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 text-white"><ScanLine className="h-5 w-5" /></div>
          <span className="text-lg font-extrabold">Scan LJK</span>
        </div>
        <div>
          <svg viewBox="0 0 240 200" className="mb-8 w-72" aria-hidden>
            <rect x="30" y="10" width="130" height="170" rx="14" fill="#fff" />
            <rect x="46" y="26" width="50" height="8" rx="4" fill="#2A2475" />
            {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3].map((c) => (
              <circle key={`${r}-${c}`} cx={58 + c * 26} cy={60 + r * 24} r="7" fill={(r * 3 + c * 5) % 4 === 0 ? '#2A2475' : 'none'} stroke="#2A2475" strokeWidth="2" />
            )))}
            <rect x="120" y="70" width="100" height="100" rx="14" fill="#5B4FD1" />
            <rect x="130" y="80" width="80" height="80" rx="8" fill="#fff" />
            <line x1="130" y1="118" x2="210" y2="118" stroke="#E8505B" strokeWidth="3" />
            <circle cx="205" cy="38" r="20" fill="#4FBF8B" />
            <path d="M195 38l7 7 13-14" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight text-ink-900">Koreksi ujian pilihan ganda dalam hitungan detik.</h2>
          <p className="mt-3 max-w-md text-ink-900/70">Atur jadwal, cetak LJK per siswa, scan dengan kamera, nilai langsung dihitung otomatis.</p>
        </div>
        <p className="text-xs text-ink-900/60">Data tersimpan aman di Supabase dengan Row Level Security.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="card w-full max-w-sm space-y-4 p-8" noValidate>
          <div>
            <h1 className="text-2xl font-extrabold">Masuk</h1>
            <p className="mt-1 text-sm text-ink-900/60">Gunakan akun admin atau guru.</p>
          </div>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="username" placeholder="nama@sekolah.sch.id" {...register('email')} />
          </Field>
          <Field label="Kata sandi" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          {error && <p role="alert" className="rounded-xl bg-rose-soft px-3 py-2 text-sm font-medium text-rose-ink">{error}</p>}
          <Button type="submit" variant="dark" className="w-full" loading={isSubmitting}>Masuk</Button>
        </form>
      </div>
    </div>
  )
}
