import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, Pencil, Plus, School, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useList, useRemove, useSave } from '@/lib/crud'
import { errMsg } from '@/lib/utils'
import type { ClassRoom, Student } from '@/lib/types'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pager, SearchInput, Select, Skeleton, TableWrap, Td, Textarea, Th, useToast, usePaged } from '@/components/ui'

const schema = z.object({
  nis: z.string().trim().min(1, 'NIS wajib diisi').max(30),
  full_name: z.string().trim().min(2, 'Nama wajib diisi').max(100),
  class_id: z.string().min(1, 'Pilih kelas'),
  gender: z.enum(['', 'L', 'P']),
  is_active: z.boolean(),
})
type Form = z.infer<typeof schema>

export default function SiswaPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const students = useList<Student>('students', '*, class:classes(name)', { column: 'full_name' })
  const classes = useList<ClassRoom>('classes', '*', { column: 'name' })
  const [q, setQ] = useState('')
  const [cls, setCls] = useState('')
  const [editing, setEditing] = useState<Student | 'new' | null>(null)
  const [del, setDel] = useState<Student | null>(null)
  const [showClasses, setShowClasses] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const rows = useMemo(() => (students.data ?? []).filter((s) =>
    (!cls || s.class_id === cls) && `${s.nis} ${s.full_name}`.toLowerCase().includes(q.toLowerCase())), [students.data, q, cls])
  const pg = usePaged(rows, 10)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { nis: '', full_name: '', class_id: '', gender: '', is_active: true } })
  const save = useSave('students', () => { toast.success('Data siswa disimpan'); setEditing(null) }, toast.error)
  const remove = useRemove('students', () => { toast.success('Data siswa dihapus'); setDel(null) }, (m) => { toast.error(m); setDel(null) })

  const open = (s: Student | 'new') => {
    reset(s === 'new' ? { nis: '', full_name: '', class_id: cls, gender: '', is_active: true } : { nis: s.nis, full_name: s.full_name, class_id: s.class_id ?? '', gender: s.gender ?? '', is_active: s.is_active })
    setEditing(s)
  }
  const onSubmit = (v: Form) => save.mutate({ nis: v.nis, full_name: v.full_name, class_id: v.class_id, gender: v.gender || null, is_active: v.is_active, ...(editing && editing !== 'new' ? { id: editing.id } : {}) })

  return (
    <>
      <PageHeader title="Data Siswa" subtitle="Peserta ujian per kelas."
        actions={isAdmin && <>
          <Button variant="outline" onClick={() => setShowClasses(true)}><School className="h-4 w-4" />Kelola Kelas</Button>
          <Button variant="outline" onClick={() => setShowImport(true)}><FileUp className="h-4 w-4" />Impor</Button>
          <Button onClick={() => open('new')}><Plus className="h-4 w-4" />Tambah Siswa</Button>
        </>} />
      <Card>
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Cari NIS atau nama…" className="min-w-56 flex-1 sm:max-w-sm" />
          <Select aria-label="Filter kelas" value={cls} onChange={(e) => setCls(e.target.value)} className="w-48">
            <option value="">Semua kelas</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        {students.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> :
          students.error ? <ErrorState error={students.error} onRetry={() => void students.refetch()} /> :
          rows.length === 0 ? <EmptyState title={q || cls ? 'Tidak ada hasil' : 'Belum ada siswa'} text={q || cls ? 'Ubah kata kunci atau filter.' : isAdmin ? 'Tambah satu per satu atau impor dari daftar (NIS, Nama, Kelas).' : 'Admin belum menambahkan data siswa.'} /> : (
            <>
              <TableWrap>
                <thead><tr><Th>NIS</Th><Th>Nama</Th><Th>Kelas</Th><Th>JK</Th><Th>Status</Th>{isAdmin && <Th className="text-right">Aksi</Th>}</tr></thead>
                <tbody>
                  {pg.slice.map((s) => (
                    <tr key={s.id} className="hover:bg-canvas/50">
                      <Td className="tabular-nums">{s.nis}</Td>
                      <Td className="font-semibold">{s.full_name}</Td>
                      <Td>{s.class?.name ? <Badge tone="indigo">{s.class.name}</Badge> : '–'}</Td>
                      <Td>{s.gender ?? '–'}</Td>
                      <Td><Badge tone={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'Aktif' : 'Nonaktif'}</Badge></Td>
                      {isAdmin && <Td className="whitespace-nowrap text-right">
                        <Button variant="ghost" size="icon" aria-label={`Ubah ${s.full_name}`} onClick={() => open(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label={`Hapus ${s.full_name}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-rose" /></Button>
                      </Td>}
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pager {...pg} />
            </>
          )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Tambah Siswa' : 'Ubah Data Siswa'}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button loading={save.isPending} onClick={() => void handleSubmit(onSubmit)()}>Simpan</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)() }} noValidate>
          <Field label="NIS" error={errors.nis?.message}><Input {...register('nis')} /></Field>
          <Field label="Nama lengkap" error={errors.full_name?.message}><Input {...register('full_name')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kelas" error={errors.class_id?.message}>
              <Select {...register('class_id')}><option value="">Pilih kelas…</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
            <Field label="Jenis kelamin"><Select {...register('gender')}><option value="">–</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></Select></Field>
          </div>
          {classes.data?.length === 0 && <p className="text-xs text-rose-ink">Belum ada kelas. Buat dulu lewat “Kelola Kelas”.</p>}
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" {...register('is_active')} />Aktif</label>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus siswa?" text={`“${del?.full_name}” beserta seluruh LJK dan nilainya akan dihapus permanen. Untuk menyembunyikan saja, ubah statusnya menjadi nonaktif.`} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onClose={() => setDel(null)} />

      <ClassesModal open={showClasses} onClose={() => setShowClasses(false)} classes={classes.data ?? []} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} classes={classes.data ?? []} onDone={() => void qc.invalidateQueries()} />
    </>
  )
}

/* ───────── Kelola kelas ───────── */
function ClassesModal({ open, onClose, classes }: { open: boolean; onClose: () => void; classes: ClassRoom[] }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [del, setDel] = useState<ClassRoom | null>(null)
  const add = useSave('classes', () => { setName(''); toast.success('Kelas ditambahkan') }, toast.error)
  const remove = useRemove('classes', () => { toast.success('Kelas dihapus'); setDel(null) }, (m) => { toast.error(m); setDel(null) })
  return (
    <>
      <Modal open={open} onClose={onClose} title="Kelola Kelas" footer={<Button variant="outline" onClick={onClose}>Selesai</Button>}>
        <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate({ name: name.trim() }) }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kelas, mis. X IPA 1" aria-label="Nama kelas" maxLength={30} />
          <Button type="submit" loading={add.isPending} disabled={!name.trim()}><Plus className="h-4 w-4" />Tambah</Button>
        </form>
        {classes.length === 0 ? <p className="py-6 text-center text-sm text-ink-900/55">Belum ada kelas.</p> : (
          <ul className="divide-y divide-ink-100/60">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold">{c.name}</span>
                <Button variant="ghost" size="icon" aria-label={`Hapus kelas ${c.name}`} onClick={() => setDel(c)}><Trash2 className="h-4 w-4 text-rose" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus kelas?" text={`Kelas “${del?.name}” akan dihapus. Siswa di kelas ini menjadi tanpa kelas. Kelas yang dipakai jadwal ujian tidak dapat dihapus.`} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onClose={() => setDel(null)} />
    </>
  )
}

/* ───────── Impor massal ───────── */
function ImportModal({ open, onClose, classes, onDone }: { open: boolean; onClose: () => void; classes: ClassRoom[]; onDone: () => void }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const imp = useMutation({
    mutationFn: async () => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const parsed: { nis: string; name: string; cls: string; gender: 'L' | 'P' | null }[] = []
      const bad: number[] = []
      lines.forEach((l, i) => {
        const c = l.split(/[\t;,]/).map((x) => x.trim())
        if (i === 0 && /^nis$/i.test(c[0])) return
        const g = (c[3] ?? '').toUpperCase()
        if (!c[0] || !c[1] || !c[2]) { bad.push(i + 1); return }
        parsed.push({ nis: c[0], name: c[1], cls: c[2], gender: g === 'L' || g === 'P' ? g : null })
      })
      if (parsed.length === 0) throw new Error('Tidak ada baris valid. Format: NIS, Nama, Kelas, JK(opsional)')
      const known = new Map(classes.map((c) => [c.name.toLowerCase(), c.id]))
      const missing = [...new Set(parsed.map((p) => p.cls).filter((n) => !known.has(n.toLowerCase())))]
      if (missing.length) {
        const { data, error } = await supabase.from('classes').insert(missing.map((name) => ({ name }))).select('id,name')
        if (error) throw error
        data?.forEach((c) => known.set(String(c.name).toLowerCase(), c.id as string))
      }
      const { error } = await supabase.from('students').upsert(
        parsed.map((p) => ({ nis: p.nis, full_name: p.name, class_id: known.get(p.cls.toLowerCase()), gender: p.gender, is_active: true })), { onConflict: 'nis' })
      if (error) throw error
      return { n: parsed.length, bad, newClasses: missing.length }
    },
    onSuccess: (r) => {
      toast.success(`${r.n} siswa diimpor${r.newClasses ? `, ${r.newClasses} kelas baru dibuat` : ''}${r.bad.length ? `. Baris dilewati: ${r.bad.join(', ')}` : ''}`)
      setText(''); onDone(); onClose()
    },
    onError: (e) => toast.error(errMsg(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title="Impor Siswa" footer={<><Button variant="outline" onClick={onClose}>Batal</Button><Button loading={imp.isPending} disabled={!text.trim()} onClick={() => imp.mutate()}>Impor</Button></>}>
      <p className="mb-2 text-sm text-ink-900/70">Tempel dari Excel/Google Sheets: satu siswa per baris dengan kolom <b>NIS, Nama, Kelas, JK</b> (JK opsional). Kelas yang belum ada dibuat otomatis. NIS yang sudah ada akan diperbarui.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false} aria-label="Data siswa" placeholder={'NIS\tNama\tKelas\tJK\n1001\tAndi Saputra\tX IPA 1\tL\n1002\tSiti Aminah\tX IPA 1\tP'} className="font-mono text-xs" />
    </Modal>
  )
}
