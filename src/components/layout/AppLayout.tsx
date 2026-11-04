import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, BookOpen, CalendarDays, LayoutDashboard, LogOut, Menu, ScanLine, Settings, UserCog, Users, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { logoUrl, useSchool } from '@/lib/hooks'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/guru', label: 'Data Guru', icon: UserCog, admin: true },
  { to: '/siswa', label: 'Data Siswa', icon: Users },
  { to: '/mapel', label: 'Mata Pelajaran', icon: BookOpen },
  { to: '/jadwal', label: 'Jadwal Ujian', icon: CalendarDays },
  { to: '/scan', label: 'Scan LJK', icon: ScanLine },
  { to: '/rekap', label: 'Rekap Nilai', icon: BarChart3 },
  { to: '/pengaturan', label: 'Pengaturan Sekolah', icon: Settings, admin: true },
]

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('flex items-center justify-center rounded-full bg-white text-ink-900', small ? 'h-9 w-9' : 'h-11 w-11')}><ScanLine className="h-5 w-5" /></div>
      <span className="text-[10px] font-extrabold tracking-widest text-white">LJK</span>
    </div>
  )
}

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const { data: school } = useSchool()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const items = NAV.filter((n) => !n.admin || isAdmin)
  const current = items.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))
  const logo = logoUrl(school?.logo_path)

  return (
    <div className="min-h-screen md:p-3">
      <div className="mx-auto flex max-w-[1440px] gap-4">
        {/* Sidebar desktop */}
        <aside className="no-print sticky top-3 hidden h-[calc(100vh-1.5rem)] w-[76px] shrink-0 flex-col items-center rounded-[28px] bg-ink-900 py-5 md:flex" aria-label="Navigasi utama">
          <Logo />
          <nav className="mt-6 flex flex-1 flex-col items-center gap-2">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} title={label} aria-label={label}
                className={({ isActive }) => cn('flex h-12 w-12 items-center justify-center rounded-2xl transition', isActive ? 'bg-white text-ink-900 shadow-lg' : 'text-white/60 hover:bg-white/10 hover:text-white')}>
                <Icon className="h-5 w-5" />
              </NavLink>
            ))}
          </nav>
          <button onClick={() => void signOut()} title="Keluar" aria-label="Keluar" className="flex h-12 w-12 items-center justify-center rounded-2xl text-white/60 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-5 w-5" />
          </button>
        </aside>

        {/* Konten */}
        <div className="min-w-0 flex-1">
          <header className="no-print flex items-center justify-between gap-3 px-4 py-3 md:px-1">
            <div className="flex items-center gap-3">
              <button className="rounded-xl bg-ink-900 p-2.5 text-white md:hidden" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
              <div className="flex items-center gap-2.5">
                {logo && <img src={logo} alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5" />}
                <div className="leading-tight">
                  <p className="text-sm font-extrabold">{school?.school_name ?? '…'}</p>
                  <p className="text-xs text-ink-900/55">{current?.label ?? 'Scan LJK'} · TA {school?.academic_year} {school?.semester}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-1.5 shadow-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary" aria-hidden>{(profile?.full_name || '?').slice(0, 1).toUpperCase()}</div>
              <div className="hidden leading-tight sm:block">
                <p className="max-w-[160px] truncate text-xs font-bold">{profile?.full_name}</p>
                <p className="text-[11px] capitalize text-ink-900/55">{profile?.role}</p>
              </div>
            </div>
          </header>
          <main className="px-4 pb-10 md:px-1"><Outlet /></main>
        </div>
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="no-print fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-900 p-5 text-white">
            <div className="mb-5 flex items-center justify-between">
              <Logo small />
              <button aria-label="Tutup menu" onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn('flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold', isActive ? 'bg-white text-ink-900' : 'text-white/70 hover:bg-white/10')}>
                  <Icon className="h-5 w-5" />{label}
                </NavLink>
              ))}
            </nav>
            <button onClick={() => void signOut()} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"><LogOut className="h-5 w-5" />Keluar</button>
          </div>
        </div>
      )}
    </div>
  )
}
