import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { SchoolSettings } from './types'

export function useSchool() {
  return useQuery({
    queryKey: ['school_settings', 'single'],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data as SchoolSettings
    },
    staleTime: 5 * 60_000,
  })
}

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('school').getPublicUrl(path).data.publicUrl
}
