import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logoUrl, useSchool } from '@/lib/hooks'
import { errMsg } from '@/lib/utils'
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Skeleton, useToast } from '@/components/ui'

const schema = z.object({
  school_name: z.string().trim().min(3, 'Nama sekolah minimal 3 karakter').max(120),
  address: z.string().trim().max(250).optional(),
  academic_year: z.string().trim().regex(/^\d{4}\/\d{4}$/, 'Format 2026/2027'),
  semester: z.enum(['Ganjil', 'Genap']),
  headmaster: z.string().trim().max(100).optional(),
  passing_grade: z.coerce.number({ invalid_type_error: 'Isi angka' }).min(0, 'Min 0').max(100, 'Maks 100'),
})
type Form = z.input<typeof schema>

const pwSchema = z.object({ password: z.string().min(8, 'Minimal 8 karakter'), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi tidak sama' })
type PwForm = z.infer<typeof pwSchema>

export default function PengaturanPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useSchool()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<Form>({ resolver: zodResolver(schema) })
  const pw = useForm<PwForm>({ resolver: zodResolver(pwSchema), defaultValues: { password: '', confirm: '' } })

  useEffect(() => {
    if (data) reset({ school_name: data.school_name, address: data.address ?? '', academic_year: data.academic_year, semester: data.semester as 'Ganjil' | 'Genap', headmaster: data.headmaster ?? '', passing_grade: data.passing_grade })
  }, [data, reset])

  const save = useMutation({
    mutationFn: async (raw: Form) => {
      const v = schema.parse(raw)
      const { error } = await supabase.from('school_settings').update({ school_name: v.school_name, address: v.address || null, academic_year: v.academic_year, semester: v.semester, headmaster: v.headmaster || null, passing_grade: v.passing_grade }).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Pengaturan disimpan'); void qc.invalidateQueries({ queryKey: ['school_settings'] }) },
    onError: (e) => toast.error(errMsg(e)),
  })

  const setLogo = async (file: File | undefined) => {
    if (!file || !data) return
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { toast.error('Format logo harus PNG, JPG, WebP, atau SVG'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran logo maksimal 2 MB'); return }
    setUploading(true)
    try {
      const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1].replace('jpeg', 'jpg')
      const path = `logo-${Date.now()}.${ext}`
      const up = await supabase.storage.from('school').upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) throw up.error
      const upd = await supabase.from('school_settings').update({ logo_path: path }).eq('id', 1)
      if (upd.error) throw upd.error
      if (data.logo_path) await supabase.storage.from('school').remove([data.logo_path])
      toast.success('Logo diperbarui'); void qc.invalidateQueries({ queryKey: ['school_settings'] })
    } catch (e) { toast.error(errMsg(e)) } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const removeLogo = async () => {
    if (!data?.logo_path) return
    const { error } = await supabase.from('school_settings').update({ logo_path: null }).eq('id', 1)
    if (error) { toast.error(errMsg(error)); return }
    await supabase.storage.from('school').remove([data.logo_path])
    toast.success('Logo dihapus'); void qc.invalidateQueries({ queryKey: ['school_settings'] })
  }

  const changePw = useMutation({
    mutationFn: async (v: PwForm) => { const { error } = await supabase.auth.updateUser({ password: v.password }); if (error) throw error },
    onSuccess: () => { toast.success('Kata sandi diubah'); pw.reset() }, onError: (e) => toast.error(errMsg(e)),
  })

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (error) return <Card><ErrorState error={error} onRetry={() => void refetch()} /></Card>
  const logo = logoUrl(data?.logo_path)

  return (
    <>
      <PageHeader title="Pengaturan Sekolah" subtitle="Identitas ini tercetak pada kop LJK dan menentukan KKM di rekap nilai." />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void handleSubmit((v) => save.mutate(v))() }} noValidate>
            <Field label="Nama sekolah" error={errors.school_name?.message} className="sm:col-span-2"><Input {...register('school_name')} /></Field>
            <Field label="Alamat (opsional)" error={errors.address?.message} className="sm:col-span-2"><Input {...register('address')} /></Field>
            <Field label="Tahun ajaran" error={errors.academic_year?.message}><Input placeholder="2026/2027" {...register('academic_year')} /></Field>
            <Field label="Semester"><Select {...register('semester')}><option>Ganjil</option><option>Genap</option></Select></Field>
            <Field label="Kepala sekolah (opsional)" error={errors.headmaster?.message}><Input {...register('headmaster')} /></Field>
            <Field label="KKM / nilai tuntas" error={errors.passing_grade?.message}><Input type="number" inputMode="decimal" min={0} max={100} step="0.5" {...register('passing_grade')} /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={save.isPending} disabled={!isDirty}>Simpan pengaturan</Button></div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="font-extrabold">Logo sekolah</h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-ink-100 bg-canvas">{logo ? <img src={logo} alt="Logo sekolah" className="h-full w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-ink-900/30" />}</div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>{logo ? 'Ganti logo' : 'Unggah logo'}</Button>
                {logo && <Button variant="ghost" size="sm" onClick={() => void removeLogo()}><Trash2 className="h-4 w-4 text-rose" />Hapus</Button>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label="Unggah logo" onChange={(e) => void setLogo(e.target.files?.[0])} />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-900/55">PNG/JPG/WebP/SVG, maksimal 2 MB. Gunakan logo hitam-putih agar cetakan LJK tetap tajam.</p>
          </Card>

          <Card className="p-6">
            <h2 className="font-extrabold">Ubah kata sandi saya</h2>
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void pw.handleSubmit((v) => changePw.mutate(v))() }} noValidate>
              <Field label="Kata sandi baru" error={pw.formState.errors.password?.message}><Input type="password" autoComplete="new-password" {...pw.register('password')} /></Field>
              <Field label="Ulangi kata sandi" error={pw.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" {...pw.register('confirm')} /></Field>
              <Button type="submit" variant="dark" loading={changePw.isPending}>Ubah kata sandi</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}
