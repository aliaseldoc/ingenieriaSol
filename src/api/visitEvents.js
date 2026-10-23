import { supabase } from '../lib/supabaseClient'
import { VISIT_EVENT_NOTA_SUPERVISOR } from '../lib/constants'
import { previousSupervisorNotesFor } from '../features/supervisorNotes/previousNotes'
import { isNetworkError } from '../offline/network'

export async function logVisitEvent(visitId, eventType, actorId, notes = null) {
  const { error } = await supabase
    .from('visit_events')
    .insert({ visit_id: visitId, event_type: eventType, actor_id: actorId, notes })
  if (error) throw error
}

// visit_event_reads viaja embebido para que el historial muestre quien leyo
// cada nota del supervisor. La RLS le devuelve al tecnico solo sus propias
// lecturas, y todas al staff.
export async function listEventsForVisit(visitId) {
  const { data, error } = await supabase
    .from('visit_events')
    .select('*, profiles(full_name), visit_event_reads(profile_id, read_at)')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function listRecentEvents(limit = 10) {
  const { data, error } = await supabase
    .from('visit_events')
    .select('*, profiles(full_name), visits(equipment_id, equipment(motor, clients(name)))')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Nota informativa del supervisor al tecnico: queda en el historial de la
// visita y no cambia su estado.
export async function sendSupervisorNote(visitId, actorId, text) {
  await logVisitEvent(visitId, VISIT_EVENT_NOTA_SUPERVISOR, actorId, text.trim())
}

// Aviso del tecnico: sus notas sin leer, ya con equipo, cliente y autor (ver
// unread_supervisor_notes en 0024).
export async function listUnreadSupervisorNotes() {
  const { data, error } = await supabase.rpc('unread_supervisor_notes')
  if (error) throw error
  return data
}

// El tecnico abrio la visita: sus notas quedan leidas. Se puede llamar cada vez
// que se abre, no duplica nada.
export async function markVisitNotesRead(visitId) {
  const { error } = await supabase.rpc('mark_visit_notes_read', { p_visit_id: visitId })
  if (error) throw error
}

// Le agrega a cada visita previous_supervisor_notes: las notas del supervisor
// de visitas anteriores del mismo equipo que pasan a esta (ver
// previousNotes.js). Una sola consulta con todas las visitas de esos equipos y
// sus notas; desde la 0030 el tecnico tambien puede leerlas. Viaja con la
// visita, asi el cache sin conexion del tecnico la guarda tal cual.
//
// Si esta consulta falla, las visitas vuelven sin las notas: la visita se
// tiene que poder abrir igual, y la sincronizacion sin conexion relee la
// visita para confirmar el guardado (ver syncQueue.js).
export async function withPreviousSupervisorNotes(visits) {
  const equipmentIds = [...new Set(visits.map((visit) => visit.equipment_id).filter(Boolean))]
  if (equipmentIds.length === 0) return visits
  const { data, error } = await supabase
    .from('visits')
    .select('id, equipment_id, scheduled_date, created_at, submitted_at, visit_events(id, notes, created_at, profiles(full_name))')
    .in('equipment_id', equipmentIds)
    .eq('visit_events.event_type', VISIT_EVENT_NOTA_SUPERVISOR)
  if (error) {
    if (!isNetworkError(error)) console.error('No se pudieron cargar las notas de visitas anteriores', error)
    return visits
  }

  const visitsByEquipment = new Map()
  for (const row of data) {
    if (!visitsByEquipment.has(row.equipment_id)) visitsByEquipment.set(row.equipment_id, [])
    visitsByEquipment.get(row.equipment_id).push(row)
  }
  return visits.map((visit) => ({
    ...visit,
    previous_supervisor_notes: previousSupervisorNotesFor(visit, visitsByEquipment.get(visit.equipment_id) ?? []),
  }))
}
