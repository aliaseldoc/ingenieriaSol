// Edge Function: renombrar el username de una persona (solo puede invocarla
// un supervisor autenticado). Usa la service_role key porque el username no
// es solo una columna de profiles: el login (ver usernameToEmail en
// src/lib/supabaseClient.js) lo convierte en el email real de auth.users, y
// ese email solo se puede cambiar con la API de administracion.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const STAFF_EMAIL_DOMAIN = Deno.env.get('STAFF_EMAIL_DOMAIN')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Falta encabezado de autorizacion' }, 401)
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'No autenticado' }, 401)
  }

  // Una cuenta desactivada o eliminada todavia puede leer su propio perfil
  // (asi la app le explica por que no entra), asi que el rol solo no alcanza.
  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role, active, deleted_at')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'supervisor' || !callerProfile.active || callerProfile.deleted_at) {
    return jsonResponse({ error: 'Solo un supervisor puede cambiar el usuario' }, 403)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud invalido' }, 400)
  }

  const { profileId, newUsername } = body

  if (!profileId || !newUsername) {
    return jsonResponse({ error: 'Faltan campos obligatorios' }, 400)
  }

  const normalizedUsername = String(newUsername).trim().toLowerCase()
  const newEmail = `${normalizedUsername}@${STAFF_EMAIL_DOMAIN}`

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(profileId)
  if (fetchError || !targetUser?.user) {
    return jsonResponse({ error: 'No se encontro a la persona' }, 404)
  }
  const previousEmail = targetUser.user.email

  const { error: authError } = await adminClient.auth.admin.updateUserById(profileId, { email: newEmail })
  if (authError) {
    return jsonResponse({ error: authError.message }, 400)
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ username: normalizedUsername })
    .eq('id', profileId)

  if (profileError) {
    await adminClient.auth.admin.updateUserById(profileId, { email: previousEmail })
    return jsonResponse({ error: profileError.message }, 400)
  }

  return jsonResponse({ ok: true, username: normalizedUsername }, 200)
})
