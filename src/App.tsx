import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isConfigured } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import { Button, Spinner } from '@/components/ui'
import LoginPage from '@/pages/LoginPage'

const Dashboard = lazy(() => import('@/pages/DashboardPage'))
const Guru = lazy(() => import('@/pages/GuruPage'))
const Siswa = lazy(() => import('@/pages/SiswaPage'))
const Mapel = lazy(() => import('@/pages/MapelPage'))
const Jadwal = lazy(() => import('@/pages/JadwalPage'))
const JadwalDetail = lazy(() => import('@/pages/JadwalDetailPage'))
const Scan = lazy(() => import('@/pages/ScanPage'))
const Rekap = lazy(() => import('@/pages/RekapPage'))
const Pengaturan = lazy(() => import('@/pages/PengaturanPage'))
const Cetak = lazy(() => import('@/pages/CetakPage'))

const Center = ({ children }: { children: ReactNode }) => <div className="flex min-h-screen items-center justify-center p-6">{children}</div>

function Gate({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { session, profile, loading, isAdmin, signOut } = useAuth()
  if (loading) return <Center><Spinner className="h-8 w-8" /></Center>
  if (!session) return <Navigate to="/login" replace />
  if (!profile || !profile.is_active) {
    return (
      <Center>
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold">Akun belum aktif</h1>
          <p className="mt-2 text-sm text-ink-900/60">Akun Anda sudah terdaftar tetapi belum diaktifkan. Hubungi administrator sekolah.</p>
          <Button variant="outline" className="mt-5" onClick={() => void signOut()}><LogOut className="h-4 w-4" />Keluar</Button>
        </div>
      </Center>
    )
  }
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  if (!isConfigured) {
    return (
      <Center>
        <div className="card max-w-lg p-8">
          <h1 className="text-xl font-extrabold">Supabase belum dikonfigurasi</h1>
          <p className="mt-2 text-sm text-ink-900/70">Salin <code className="rounded bg-canvas px-1.5 py-0.5">.env.example</code> menjadi <code className="rounded bg-canvas px-1.5 py-0.5">.env.local</code>, isi <b>VITE_SUPABASE_URL</b> dan <b>VITE_SUPABASE_ANON_KEY</b>, lalu jalankan ulang <code className="rounded bg-canvas px-1.5 py-0.5">npm run dev</code>.</p>
        </div>
      </Center>
    )
  }
  return (
    <Suspense fallback={<Center><Spinner className="h-8 w-8" /></Center>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cetak/:examId" element={<Gate><Cetak /></Gate>} />
        <Route element={<Gate><AppLayout /></Gate>}>
          <Route index element={<Dashboard />} />
          <Route path="guru" element={<Gate admin><Guru /></Gate>} />
          <Route path="siswa" element={<Siswa />} />
          <Route path="mapel" element={<Mapel />} />
          <Route path="jadwal" element={<Jadwal />} />
          <Route path="jadwal/:id" element={<JadwalDetail />} />
          <Route path="scan" element={<Scan />} />
          <Route path="rekap" element={<Rekap />} />
          <Route path="pengaturan" element={<Gate admin><Pengaturan /></Gate>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
