import { supabase } from '../lib/supabaseClient'
import { REPAIR_EVENT_TYPE, REPAIR_STATUS_DATE_FIELD } from '../lib/constants'
import { toISODateString } from '../lib/dateUtils'

// La lista y el detalle leen lo mismo: el equipo con su cliente, la visita que
// abrio el caso (fecha y falla que describio el tecnico) y el ultimo evento de
// la bitacora, que marca la ultima novedad.
const REPAIR_SELECT =
  '*, equipment(id, internal_code, motor, generador, clients(id, name)), visits(id, scheduled_date, fault_description), repair_events(created_at)'

export async function listRepairs() {
  const { data, error } = await supabase
    .from('repairs')
    .select(REPAIR_SELECT)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'repair_events', ascending: false })
    .limit(1, { referencedTable: 'repair_events' })
  if (error) throw error
  return data
}

export async function listRepairEvents(repairId) {
  const { data, error } = await supabase
    .from('repair_events')
    .select('*, profiles(full_name)')
    .eq('repair_id', repairId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// "Reparacion Solicitada" de la validacion: aprueba la visita y abre el caso en
// una sola transaccion (ver request_visit_repair en 0024). Devuelve el id del
// caso nuevo.
export async function requestVisitRepair(visitId, description) {
  const { data, error } = await supabase.rpc('request_visit_repair', {
    p_visit_id: visitId,
    p_description: description,
  })
  if (error) throw error
  return data
}

async function updateRepair(repairId, changes) {
  const { error } = await supabase.from('repairs').update(changes).eq('id', repairId)
  if (error) throw error
}

async function logRepairEvent(repairId, eventType, actorId, { fromStatus = null, toStatus = null, notes = null } = {}) {
  const { error } = await supabase.from('repair_events').insert({
    repair_id: repairId,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    notes,
    actor_id: actorId,
  })
  if (error) throw error
}

// Cambia el estado y deja el paso en la bitacora. Si el estado nuevo tiene una
// fecha propia (ver REPAIR_STATUS_DATE_FIELD) y todavia estaba vacia, se
// completa con la de hoy.
export async function changeRepairStatus(repair, nextStatus, comment, actorId) {
  const changes = { status: nextStatus }
  const dateField = REPAIR_STATUS_DATE_FIELD[nextStatus]
  if (dateField && !repair[dateField]) changes[dateField] = toISODateString(new Date())
  await updateRepair(repair.id, changes)
  await logRepairEvent(repair.id, REPAIR_EVENT_TYPE.ESTADO, actorId, {
    fromStatus: repair.status,
    toStatus: nextStatus,
    notes: comment.trim() || null,
  })
}

// Datos del caso (presupuesto, fechas, proximo paso): el resumen de lo que
// cambio lo arma quien llama y queda en la bitacora.
export async function saveRepairData(repairId, changes, summary, actorId) {
  await updateRepair(repairId, changes)
  await logRepairEvent(repairId, REPAIR_EVENT_TYPE.DATOS, actorId, { notes: summary })
}

export async function addRepairNote(repairId, text, actorId) {
  await logRepairEvent(repairId, REPAIR_EVENT_TYPE.NOTA, actorId, { notes: text.trim() })
}
