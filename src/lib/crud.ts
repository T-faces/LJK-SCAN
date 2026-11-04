import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { errMsg } from './utils'

export function useList<T>(table: string, select = '*', order?: { column: string; ascending?: boolean }, extraKey: unknown[] = []) {
  return useQuery({
    queryKey: [table, select, order, ...extraKey],
    queryFn: async () => {
      let q = supabase.from(table).select(select)
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true })
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as T[]
    },
  })
}

/** Insert (tanpa id) atau update (dengan id). */
export function useSave(table: string, onDone?: () => void, onError?: (m: string) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: Record<string, unknown> & { id?: string }) => {
      const { id, ...rest } = row
      const res = id ? await supabase.from(table).update(rest).eq('id', id) : await supabase.from(table).insert(rest)
      if (res.error) throw res.error
    },
    onSuccess: () => { void qc.invalidateQueries(); onDone?.() },
    onError: (e) => onError?.(errMsg(e)),
  })
}

export function useRemove(table: string, onDone?: () => void, onError?: (m: string) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries(); onDone?.() },
    onError: (e) => onError?.(errMsg(e)),
  })
}
