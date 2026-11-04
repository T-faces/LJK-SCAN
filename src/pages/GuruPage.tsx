import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, Power, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useList, useRemove, useSave } from '@/lib/crud'
import { errMsg } from '@/lib/utils'
import type { Teacher } from '@/lib/types'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pager, SearchInput, Skeleton, TableWrap, Td, Th, useToast, usePaged } from '@/components/ui'

const schema = z.object({
  full_name: z.string().trim().min(3, 'Nama minimal 3 karakter').max(100),
  nip: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(20).optional(),
  is_active: z.boolean(),
})
type Form = z.input<typeof schema>

const accSchema = z.object({
  email: z.string().trim().email('Email tidak valid').optional().or(z.literal('')),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
})
type AccForm = z.infer<typeof accSchema>

export default function GuruPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useList<Teacher>('teachers', '*', { column: 'full_name' })
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Teacher | 'new' | null>(null)
  const [del, setDel] = useState<Teacher | null>(null)
  const [acc, setAcc] = useState<Teacher | null>(null)

  const rows = useMemo(() => (data ?? []).filter((t) => `${t.full_name} ${t.nip ?? ''} ${t.email ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, q])
  const pg = usePaged(rows, 10)

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { full_name: '', nip: '', phone: '', is_active: true } })
  const accForm = useForm<AccForm>({ resolver: zodResolver(accSchema), defaultValues: { email: '', password: '' } })

  const save = useSave('teachers', () => { toast.success('Data guru disimpan'); setEditing(null) }, toast.error)
  const remove = useRemove('teachers', () => { toast.success('Data guru dihapus'); setDel(null) }, (m) => { toast.error(m); setDel(null) })

  const fn = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('admin-users', { body })
      if (error) {
        // ambil pesan dari body respons Edge Function bila ada
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') { try { const j = await ctx.json(); if (j?.error) throw new Error(j.error) } catch (e) { if (e instanceof Error && e.message) throw e } }
        throw error
      }
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => { void qc.invalidateQueries() },
    onError: (e) => toast.error(errMsg(e)),
  })

  const openEdit = (t: Teacher | 'new') => {
    form.reset(t === 'new' ? { full_name: '', nip: '', phone: '', is_active: true } : { full_name: t.full_name, nip: t.nip ?? '', phone: t.phone ?? '', is_active: t.is_active })
    setEditing(t)
  }
  const onSubmit = (v: Form) => {
    const p = schema.parse(v)
    save.mutate({ full_name: p.full_name, nip: p.nip || null, phone: p.phone || null, is_active: p.is_active, ...(editing && editing !== 'new' ? { id: editing.id } : {}) })
  }
  const openAcc = (t: Teacher) => { accForm.reset({ email: t.email ?? '', password: '' }); setAcc(t) }
  const onAcc = (v: AccForm) => {
    if (!acc) return
    if (!acc.user_id && !v.email) { accForm.setError('email', { message: 'Email wajib diisi' }); return }
    fn.mutate(
      acc.user_id ? { action: 'reset_password', teacher_id: acc.id, password: v.password } : { action: 'create_account', teacher_id: acc.id, email: v.email, password: v.password },
      { onSuccess: () => { toast.success(acc.user_id ? 'Kata sandi diubah' : 'Akun guru dibuat'); setAcc(null) } },
    )
  }

  return (
    <>
      <PageHeader title="Data Guru" subtitle="Kelola guru dan akun login mereka." actions={<Button onClick={() => openEdit('new')}><Plus className="h-4 w-4" />Tambah Guru</Button>} />
      <Card>
        <div className="p-4"><SearchInput value={q} onChange={setQ} placeholder="Cari nama, NIP, atau email…" className="max-w-sm" /></div>
        {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> :
          error ? <ErrorState error={error} onRetry={() => void refetch()} /> :
          rows.length === 0 ? <EmptyState title={q ? 'Tidak ada hasil' : 'Belum ada data guru'} text={q ? 'Coba kata kunci lain.' : 'Tambahkan guru, lalu buatkan akun login agar dapat membuat jadwal dan scan LJK.'} /> : (
            <>
              <TableWrap>
                <thead><tr><Th>Nama</Th><Th>NIP</Th><Th>Akun login</Th><Th>Status</Th><Th className="text-right">Aksi</Th></tr></thead>
                <tbody>
                  {pg.slice.map((t) => (
                    <tr key={t.id} className="hover:bg-canvas/50">
                      <Td><p className="font-semibold">{t.full_name}</p>{t.phone && <p className="text-xs text-ink-900/55">{t.phone}</p>}</Td>
                      <Td>{t.nip ?? '–'}</Td>
                      <Td>{t.user_id ? <><Badge tone="indigo">Ada akun</Badge><p className="mt-1 text-xs text-ink-900/55">{t.email}</p></> : <Badge>Belum ada</Badge>}</Td>
                      <Td><Badge tone={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Aktif' : 'Nonaktif'}</Badge></Td>
                      <Td className="whitespace-nowrap text-right">
                        <Button variant="ghost" size="icon" aria-label={t.user_id ? `Reset kata sandi ${t.full_name}` : `Buat akun ${t.full_name}`} title={t.user_id ? 'Reset kata sandi' : 'Buat akun login'} onClick={() => openAcc(t)}>{t.user_id ? <KeyRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}</Button>
                        <Button variant="ghost" size="icon" aria-label={t.is_active ? `Nonaktifkan ${t.full_name}` : `Aktifkan ${t.full_name}`} title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => fn.mutate({ action: 'set_active', teacher_id: t.id, active: !t.is_active }, { onSuccess: () => toast.success(t.is_active ? 'Guru dinonaktifkan' : 'Guru diaktifkan') })}><Power className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label={`Ubah ${t.full_name}`} onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label={`Hapus ${t.full_name}`} onClick={() => setDel(t)}><Trash2 className="h-4 w-4 text-rose" /></Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pager {...pg} />
            </>
          )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Tambah Guru' : 'Ubah Data Guru'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button loading={save.isPending} onClick={() => void form.handleSubmit(onSubmit)()}>Simpan</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(onSubmit)() }} noValidate>
          <Field label="Nama lengkap" error={form.formState.errors.full_name?.message}><Input {...form.register('full_name')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="NIP (opsional)" error={form.formState.errors.nip?.message}><Input {...form.register('nip')} /></Field>
            <Field label="No. HP (opsional)" error={form.formState.errors.phone?.message}><Input inputMode="tel" {...form.register('phone')} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" {...form.register('is_active')} />Aktif</label>
        </form>
      </Modal>

      <Modal open={!!acc} onClose={() => setAcc(null)} title={acc?.user_id ? 'Reset Kata Sandi' : 'Buat Akun Login Guru'} size="sm"
        footer={<><Button variant="outline" onClick={() => setAcc(null)}>Batal</Button><Button loading={fn.isPending} onClick={() => void accForm.handleSubmit(onAcc)()}>{acc?.user_id ? 'Simpan' : 'Buat akun'}</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void accForm.handleSubmit(onAcc)() }} noValidate>
          <p className="text-sm text-ink-900/70">{acc?.full_name}</p>
          {!acc?.user_id && <Field label="Email login" error={accForm.formState.errors.email?.message}><Input type="email" autoComplete="off" {...accForm.register('email')} /></Field>}
          <Field label={acc?.user_id ? 'Kata sandi baru' : 'Kata sandi awal'} error={accForm.formState.errors.password?.message} hint="Minimal 8 karakter. Sampaikan ke guru secara langsung.">
            <Input type="password" autoComplete="new-password" {...accForm.register('password')} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!del} title="Hapus data guru?" text={`“${del?.full_name}” akan dihapus. Akun login (jika ada) tidak ikut terhapus; nonaktifkan guru bila hanya ingin mencabut akses. Ujian milik guru ini menjadi tanpa pengampu.`} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onClose={() => setDel(null)} />
    </>
  )
}
