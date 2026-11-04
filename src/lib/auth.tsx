import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, Teacher } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  teacher: Teacher | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}
const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setTeacher(null); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    setProfile((p as Profile) ?? null)
    const { data: t } = await supabase.from('teachers').select('*').eq('user_id', s.user.id).maybeSingle()
    setTeacher((t as Teacher) ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // jangan await Supabase di dalam callback; tunda satu tick
      setTimeout(() => void loadProfile(s), 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const value = useMemo<AuthState>(() => ({
    session, profile, teacher, loading,
    isAdmin: profile?.role === 'admin' && profile.is_active,
    signOut: async () => { await supabase.auth.signOut() },
    refresh: () => loadProfile(session),
  }), [session, profile, teacher, loading, loadProfile])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth harus di dalam AuthProvider')
  return v
}
