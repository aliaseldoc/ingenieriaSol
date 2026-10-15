// Edge Function: eliminar a una persona de Personal (solo puede invocarla un
// supervisor activo).
//
// La persona no desaparece de la base: su perfil queda como "lapida" para que
// las visitas que hizo sigan mostrando su nombre tal cual (ver
// delete_staff_member en la migracion 0026). Lo que se borra es su cuenta de
// acceso, que solo se puede tocar con la API de administracion (por eso la
// service_role key), y sus horas.
//
// Orden: primero la cuenta y despues los datos. Si falla la cuenta, no se
// perdio ninguna hora. Si falla la base despues, la persona ya no puede entrar
// y un reintento termina el trabajo: las dos partes toleran estar ya hechas.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
    return jsonResponse({ error: 'Solo un supervisor puede eliminar personal' }, 403)
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
  if (profileId === user.id) {
    return jsonResponse({ error: 'No podés eliminar tu propio usuario.' }, 400)
  }

  // Se verifica que sea alguien de Personal antes de borrar una cuenta: la API
  // de administracion borraria cualquier usuario que se le pase.
  const { data: target } = await callerClient.from('profiles').select('id').eq('id', profileId).maybeSingle()
  if (!target) {
    return jsonResponse({ error: 'No se encontró a esa persona.' }, 404)
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { error: authError } = await adminClient.auth.admin.deleteUser(profileId)
  // En un reintento la cuenta ya no existe: se sigue con los datos igual.
  const cuentaYaBorrada = authError?.status === 404 || /not.?found/i.test(authError?.message ?? '')
  if (authError && !cuentaYaBorrada) {
    return jsonResponse({ error: `No se pudo borrar la cuenta de acceso: ${authError.message}` }, 400)
  }

  const { data: result, error: dataError } = await callerClient.rpc('delete_staff_member', { p_profile_id: profileId })
  if (dataError) {
    return jsonResponse({ error: dataError.message }, 400)
  }

  return jsonResponse({ ok: true, ...result }, 200)
})
