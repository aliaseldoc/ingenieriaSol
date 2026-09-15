import { supabase } from '../lib/supabaseClient'
import { PUNCH_SOURCE } from '../lib/constants'

// Supabase corta cada consulta en 1000 filas: una semana con mucho personal
// puede superarlas, asi que se pide de a paginas hasta traer todo.
const PAGE_SIZE = 1000

async function fetchAllPages(buildQuery) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

// Todos los fichajes (tambien los anulados) entre dos instantes ISO. Con
// employeeId filtra a una persona; sin el, trae los de todo el personal.
export async function listPunchesInRange({ from, to, employeeId = null }) {
  return fetchAllPages(() => {
    let query = supabase.from('time_punches').select('*').gte('punched_at', from).lt('punched_at', to).order('punched_at')
    if (employeeId) query = query.eq('employee_id', employeeId)
    return query
  })
}

// Fichajes de la app que sincronizaron con la semana ya cerrada (para las
// alertas del panel). Solo los recientes: los viejos ya se revisaron.
export async function listPunchesArrivedAfterClose(sinceIso) {
  const { data, error } = await supabase
    .from('time_punches')
    .select('id, employee_id, punched_at, received_at')
    .eq('arrived_after_close', true)
    .is('voided_at', null)
    .gte('received_at', sinceIso)
    .order('punched_at')
  if (error) throw error
  return data
}

// Fichaje del tecnico desde la app. El id lo genera el celular, asi un
// reintento de sincronizacion nunca lo duplica (choca con la clave primaria).
export async function insertAppPunch(punch) {
  const { error } = await supabase.from('time_punches').insert(punch)
  if (error) throw error
}

export async function addManualPunch({ employeeId, punchType, punchedAt, reason, actorId, replacesPunchId = null }) {
  const { data, error } = await supabase
    .from('time_punches')
    .insert({
      employee_id: employeeId,
      punch_type: punchType,
      punched_at: punchedAt,
      source: PUNCH_SOURCE.MANUAL,
      reason,
      created_by: actorId,
      replaces_punch_id: replacesPunchId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Nunca se borra: queda anulado con quien, cuando y por que.
export async function voidPunch({ punchId, reason, actorId }) {
  const { error } = await supabase
    .from('time_punches')
    .update({ voided_at: new Date().toISOString(), voided_by: actorId, void_reason: reason })
    .eq('id', punchId)
    .is('voided_at', null)
  if (error) throw error
}

// Corregir la hora = crear el manual que lo reemplaza y anular el original.
// Primero el alta: si fallara la anulacion, queda un fichaje de mas a la
// vista (y el dia marcado para revisar), nunca un fichaje perdido.
export async function correctPunchTime({ punch, punchType, punchedAt, reason, actorId }) {
  await addManualPunch({ employeeId: punch.employee_id, punchType, punchedAt, reason, actorId, replacesPunchId: punch.id })
  await voidPunch({ punchId: punch.id, reason, actorId })
}

export async function listPunchImports(limit = 20) {
  const { data, error } = await supabase
    .from('punch_imports')
    .select('*, profiles(full_name)')
    .order('imported_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

const IMPORT_CHUNK_SIZE = 500

// punches: filas { employee_id, punched_at } ya filtradas (sin legajos
// desconocidos ni semanas cerradas). Los duplicados que igual lleguen al
// servidor se ignoran por la restriccion unica, y se suman al conteo.
export async function importClockPunches({ fileName, actorId, punches, stats }) {
  const { data: importRow, error: importError } = await supabase
    .from('punch_imports')
    .insert({
      file_name: fileName,
      imported_by: actorId,
      rows_total: stats.total,
      rows_duplicated: stats.duplicated,
      rows_unknown: stats.unknown,
      rows_closed_week: stats.closedWeek,
    })
    .select()
    .single()
  if (importError) throw importError

  let insertedCount = 0
  for (let start = 0; start < punches.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = punches.slice(start, start + IMPORT_CHUNK_SIZE).map((punch) => ({
      ...punch,
      source: PUNCH_SOURCE.RELOJ,
      import_id: importRow.id,
      created_by: actorId,
    }))
    const { data, error } = await supabase
      .from('time_punches')
      .upsert(chunk, { onConflict: 'employee_id,punched_at,source', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    insertedCount += data.length
  }

  const duplicated = stats.duplicated + (punches.length - insertedCount)
  const { data: updated, error: updateError } = await supabase
    .from('punch_imports')
    .update({ rows_inserted: insertedCount, rows_duplicated: duplicated })
    .eq('id', importRow.id)
    .select()
    .single()
  if (updateError) throw updateError
  return updated
}
