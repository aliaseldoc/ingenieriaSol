// Edge Function: restaurar la contrasena de una persona a la de siempre,
// "123456" (solo puede invocarla un supervisor autenticado). Usa la
// service_role key porque la contrasena de otra cuenta solo se cambia con la
// API de administracion. La contrasena no viaja desde la app: esta funcion
// solo sabe volverla a la inicial.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// La misma que muestra la app (RESET_PASSWORD en src/api/staff.js).
const RESET_PASSWORD = '123456'

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
    return jsonResponse({ error: 'Solo un supervisor puede restaurar la contraseña' }, 403)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud invalido' }, 400)
  }

  const { profileId } = body
  if (!profileId) {
    return jsonResponse({ error: 'Faltan campos obligatorios' }, 400)
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Una persona eliminada ya no tiene cuenta de acceso (delete-staff la borra).
  const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(profileId)
  if (fetchError || !targetUser?.user) {
    return jsonResponse({ error: 'No se encontró la cuenta de esa persona' }, 404)
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(profileId, { password: RESET_PASSWORD })
  if (authError) {
    return jsonResponse({ error: authError.message }, 400)
  }

  return jsonResponse({ ok: true }, 200)
})
