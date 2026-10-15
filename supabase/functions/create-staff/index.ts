// Edge Function: alta de personal (solo puede invocarla un supervisor autenticado).
// Usa la service_role key para crear el usuario en auth.users sin reemplazar
// la sesion de quien hace la llamada (lo que ocurriria con un signUp() del lado del cliente).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const STAFF_EMAIL_DOMAIN = Deno.env.get('STAFF_EMAIL_DOMAIN')

const ALLOWED_ROLES = ['administrativo', 'tecnico', 'supervisor']

// El navegador siempre manda un preflight OPTIONS antes del POST real;
// sin estos headers en TODAS las respuestas, el fetch del browser falla por CORS.
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
    return jsonResponse({ error: 'Solo un supervisor puede dar de alta personal' }, 403)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud invalido' }, 400)
  }

  const { username, fullName, role, password, phone, address, registeredAt } = body

  if (!username || !fullName || !role || !password) {
    return jsonResponse({ error: 'Faltan campos obligatorios' }, 400)
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return jsonResponse({ error: 'Rol invalido' }, 400)
  }

  const normalizedUsername = String(username).trim().toLowerCase()
  const email = `${normalizedUsername}@${STAFF_EMAIL_DOMAIN}`

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return jsonResponse({ error: createError?.message ?? 'No se pudo crear el usuario' }, 400)
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    username: normalizedUsername,
    full_name: fullName,
    role,
    phone: phone || null,
    address: address || null,
    ...(registeredAt ? { registered_at: registeredAt } : {}),
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return jsonResponse({ error: profileError.message }, 400)
  }

  return jsonResponse({ ok: true, username: normalizedUsername }, 200)
})
