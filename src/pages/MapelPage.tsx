import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useList, useRemove, useSave } from '@/lib/crud'
import type { Subject } from '@/lib/types'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pager, SearchInput, Skeleton, TableWrap, Td, Th, useToast, usePaged } from '@/components/ui'

const schema = z.object({
  code: z.string().trim().min(2, 'Kode minimal 2 karakter').max(10, 'Maksimal 10 karakter').transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, 'Nama wajib diisi').max(80),
  is_active: z.boolean(),
})
type Form = z.input<typeof schema>

export default function MapelPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useList<Subject>('subjects', '*', { column: 'name' })
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Subject | 'new' | null>(null)
  const [del, setDel] = useState<Subject | null>(null)

  const rows = useMemo(() => (data ?? []).filter((s) => `${s.code} ${s.name}`.toLowerCase().includes(q.toLowerCase())), [data, q])
  const pg = usePaged(rows, 10)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { code: '', name: '', is_active: true } })
  const save = useSave('subjects', () => { toast.success('Mata pelajaran disimpan'); setEditing(null) }, toast.error)
  const remove = useRemove('subjects', () => { toast.success('Mata pelajaran dihapus'); setDel(null) }, (m) => { toast.error(m); setDel(null) })

  const open = (s: Subject | 'new') => {
    reset(s === 'new' ? { code: '', name: '', is_active: true } : { code: s.code, name: s.name, is_active: s.is_active })
    setEditing(s)
  }
  const onSubmit = (v: Form) => {
    const p = schema.parse(v)
    save.mutate({ ...p, ...(editing && editing !== 'new' ? { id: editing.id } : {}) })
  }

  return (
    <>
      <PageHeader title="Mata Pelajaran" subtitle="Daftar mata pelajaran yang diujikan." actions={isAdmin && <Button onClick={() => open('new')}><Plus className="h-4 w-4" />Tambah Mapel</Button>} />
      <Card>
        <div className="p-4"><SearchInput value={q} onChange={setQ} placeholder="Cari kode atau nama mapel…" className="max-w-sm" /></div>
        {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> :
          error ? <ErrorState error={error} onRetry={() => void refetch()} /> :
          rows.length === 0 ? <EmptyState title={q ? 'Tidak ada hasil' : 'Belum ada mata pelajaran'} text={q ? 'Coba kata kunci lain.' : 'Tambahkan mata pelajaran pertama Anda.'} action={isAdmin && !q && <Button onClick={() => open('new')}><Plus className="h-4 w-4" />Tambah Mapel</Button>} /> : (
            <>
              <TableWrap>
                <thead><tr><Th>Kode</Th><Th>Nama Mata Pelajaran</Th><Th>Status</Th>{isAdmin && <Th className="text-right">Aksi</Th>}</tr></thead>
                <tbody>
                  {pg.slice.map((s) => (
                    <tr key={s.id} className="hover:bg-canvas/50">
                      <Td><Badge tone="amber">{s.code}</Badge></Td>
                      <Td className="font-semibold">{s.name}</Td>
                      <Td><Badge tone={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'Aktif' : 'Nonaktif'}</Badge></Td>
                      {isAdmin && <Td className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Ubah ${s.name}`} onClick={() => open(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label={`Hapus ${s.name}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-rose" /></Button>
                      </Td>}
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pager {...pg} />
            </>
          )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Tambah Mata Pelajaran' : 'Ubah Mata Pelajaran'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button loading={save.isPending} onClick={() => void handleSubmit(onSubmit)()}>Simpan</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)() }} noValidate>
          <Field label="Kode" error={errors.code?.message} hint="Contoh: MTK, BIN, IPA"><Input {...register('code')} className="uppercase" /></Field>
          <Field label="Nama mata pelajaran" error={errors.name?.message}><Input {...register('name')} /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" {...register('is_active')} />Aktif</label>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus mata pelajaran?" text={`“${del?.name}” akan dihapus. Mapel yang sudah dipakai pada jadwal ujian tidak dapat dihapus.`} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onClose={() => setDel(null)} />
    </>
  )
}
