import { supabase } from '../lib/supabaseClient'
import { VISIT_EVENT_NOTA_SUPERVISOR } from '../lib/constants'

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
