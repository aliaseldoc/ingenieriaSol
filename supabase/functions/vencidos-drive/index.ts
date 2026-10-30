// Edge Function: agrega a la planilla de Drive una hoja con los services de
// aceite y baterias vencidos, por vencer o sin fecha (pedido del 30/10/2026:
// que el reporte sea siempre el mismo archivo y que cada actualizacion sume una
// hoja con la fecha). La invoca el boton "Actualizar Vencidos" de Equipos y
// solo la pueden usar el administrativo y el supervisor.
//
// - La lista sale de las mismas reglas que tenia el Excel
//   (src/features/equipmentInventory/overdueServices.js), con los datos que
//   ve quien la pide.
// - La hoja nueva va primera y se llama "Vencidos DD-MM-AAAA". Si ya habia una
//   de hoy, se reemplaza.
// - Las observaciones escritas en la hoja mas reciente pasan a la nueva cuando
//   el mismo equipo y service siguen en la lista (decision del usuario).
//
// Configuracion (secretos de Supabase): GOOGLE_SERVICE_ACCOUNT_JSON, la clave
// de la cuenta de servicio, y VENCIDOS_SHEET_ID, el id de la planilla (lo que
// va entre /d/ y /edit en su link). La planilla es de la cuenta de la empresa
// y se le comparte a la cuenta de servicio como Editor.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { googleAccessToken } from '../_shared/google.ts'
import {
  buildOverdueServiceRows,
  buildOverdueServicesTable,
  overdueRowKey,
} from '../../../src/features/equipmentInventory/overdueServices.js'
import { parseDateInput } from '../../../src/lib/dateUtils.js'
import { buildSheetRequests, latestSheet, newSheetId, observationsByKey, sheetRange, sheetTitle } from './planilla.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
const SPREADSHEET_ID = Deno.env.get('VENCIDOS_SHEET_ID')

const ALLOWED_ROLES = ['administrativo', 'supervisor']
const ZONA = 'America/Argentina/Buenos_Aires'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

const EQUIPMENT_COLUMNS =
  'id, client_id, motor, internal_code, oil_filter_changed_at, oil_filter_next_due_at, oil_capacity, oil_filter_spec, battery_changed_at, battery_next_due_at, battery_quantity, battery_size'
const CLIENT_COLUMNS = 'id, name, contact_name, contact_phone, active'

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

// El cliente de Supabase con la sesion de quien llama, si es administrativo o
// supervisor activo. Una cuenta desactivada o eliminada todavia puede leer su
// propio perfil, asi que el rol solo no alcanza.
async function identificar(req) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
  } = await callerClient.auth.getUser()
  if (!user) return null
  const { data: profile } = await callerClient
    .from('profiles')
    .select('role, active, deleted_at')
    .eq('id', user.id)
    .single()
  if (!ALLOWED_ROLES.includes(profile?.role) || !profile.active || profile.deleted_at) return null
  return callerClient
}

// 'AAAA-MM-DD' de hoy en Argentina: la funcion corre en UTC y despues de las
// 21 ya seria manana.
function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  )
}

function mensajeDeGoogle(status, body) {
  const detalle = body?.error?.message ?? ''
  if (status === 403) return 'La cuenta de servicio no puede editar la planilla de Drive: compartila con ella como Editor.'
  if (status === 404) return 'No se encontró la planilla de Drive. Revisá el id configurado.'
  if (status === 400 && detalle.includes('already exists')) {
    return 'Otra persona está actualizando la planilla en este momento. Probá de nuevo en unos segundos.'
  }
  return `Google respondió con un error (${status}): ${detalle || 'sin detalle'}`
}

async function sheetsFetch(token, path, init = {}) {
  const response = await fetch(`${SHEETS_API}/${SPREADSHEET_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(mensajeDeGoogle(response.status, body))
  return body
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido' }, 405)
  }

  try {
    const callerClient = await identificar(req)
    if (!callerClient) return jsonResponse({ error: 'No tenés permiso para actualizar la planilla de vencidos.' }, 403)
    if (!SERVICE_ACCOUNT_JSON || !SPREADSHEET_ID) {
      return jsonResponse({ error: 'Falta configurar la planilla de Drive (cuenta de servicio o id de la planilla).' }, 500)
    }

    const [equipmentResult, clientsResult] = await Promise.all([
      callerClient.from('equipment').select(EQUIPMENT_COLUMNS),
      callerClient.from('clients').select(CLIENT_COLUMNS),
    ])
    if (equipmentResult.error) throw equipmentResult.error
    if (clientsResult.error) throw clientsResult.error

    const todayKey = hoyArgentina()
    const title = sheetTitle(todayKey)
    const token = await googleAccessToken(JSON.parse(SERVICE_ACCOUNT_JSON), SHEETS_SCOPE)
    const { sheets } = await sheetsFetch(token, '?fields=sheets.properties(sheetId,title)')
    const existingSheets = sheets.map((sheet) => sheet.properties)

    const source = latestSheet(existingSheets, todayKey)
    const observations = source
      ? observationsByKey((await sheetsFetch(token, `/values/${encodeURIComponent(sheetRange(source.title))}`)).values)
      : new Map()

    const rows = buildOverdueServiceRows(equipmentResult.data, clientsResult.data, parseDateInput(todayKey)).map((row) => ({
      ...row,
      observation: observations.get(overdueRowKey(row)) ?? null,
    }))
    const sheetId = newSheetId(existingSheets)
    const replaceSheetId = existingSheets.find((sheet) => sheet.title === title)?.sheetId ?? null
    await sheetsFetch(token, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: buildSheetRequests({ table: buildOverdueServicesTable(rows), title, sheetId, replaceSheetId }) }),
    })

    return jsonResponse(
      {
        title,
        url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheetId}`,
        services: rows.length,
        observations: rows.filter((row) => row.observation).length,
      },
      200
    )
  } catch (error) {
    return jsonResponse({ error: error?.message || 'No se pudo actualizar la planilla de vencidos.' }, 500)
  }
})
