// Edge Function: kelola akun guru. Hanya dapat dipanggil oleh admin aktif.
// Deploy: supabase functions deploy admin-users
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY tersedia otomatis.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Tidak terautentikasi' }, 401)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: prof } = await admin.from('profiles').select('role,is_active').eq('id', user.id).single()
    if (!prof || prof.role !== 'admin' || !prof.is_active) return json({ error: 'Hanya admin yang diizinkan' }, 403)

    const body = await req.json()
    const { data: teacher, error: terr } = await admin.from('teachers').select('*').eq('id', body.teacher_id).single()
    if (terr || !teacher) return json({ error: 'Data guru tidak ditemukan' }, 404)

    switch (body.action) {
      case 'create_account': {
        if (teacher.user_id) return json({ error: 'Guru ini sudah memiliki akun' }, 400)
        const email = String(body.email ?? '').trim().toLowerCase()
        const password = String(body.password ?? '')
        if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Email tidak valid' }, 400)
        if (password.length < 8) return json({ error: 'Kata sandi minimal 8 karakter' }, 400)
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { full_name: teacher.full_name },
        })
        if (error || !data.user) return json({ error: error?.message ?? 'Gagal membuat akun' }, 400)
        await admin.from('profiles').update({ role: 'guru', is_active: true, full_name: teacher.full_name }).eq('id', data.user.id)
        await admin.from('teachers').update({ user_id: data.user.id, email }).eq('id', teacher.id)
        return json({ ok: true })
      }
      case 'reset_password': {
        if (!teacher.user_id) return json({ error: 'Guru belum memiliki akun' }, 400)
        const password = String(body.password ?? '')
        if (password.length < 8) return json({ error: 'Kata sandi minimal 8 karakter' }, 400)
        const { error } = await admin.auth.admin.updateUserById(teacher.user_id, { password })
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }
      case 'set_active': {
        const active = Boolean(body.active)
        await admin.from('teachers').update({ is_active: active }).eq('id', teacher.id)
        if (teacher.user_id) await admin.from('profiles').update({ is_active: active }).eq('id', teacher.user_id)
        return json({ ok: true })
      }
      default:
        return json({ error: 'Aksi tidak dikenal' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
