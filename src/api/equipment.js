import { supabase } from '../lib/supabaseClient'
import { invokeEdgeFunction } from './edgeFunctions'
import { normalizeVisit } from './visits'
import { VISIT_STATUS } from '../lib/constants'

export async function listEquipmentWithClients() {
  const { data, error } = await supabase
    .from('equipment')
    .select('*, clients(id, name, active)')
    .order('motor')
  if (error) throw error
  return data
}

// Agrega la hoja de hoy a la planilla de vencidos de Drive (Edge Function
// vencidos-drive). Devuelve { title, url, services, observations }.
export function updateOverdueServicesSheet() {
  return invokeEdgeFunction('vencidos-drive', {})
}

export async function getEquipmentById(equipmentId) {
  const { data, error } = await supabase.from('equipment').select('*, clients(id, name)').eq('id', equipmentId).single()
  if (error) throw error
  return data
}

export async function createEquipment(equipment) {
  const { data, error } = await supabase.from('equipment').insert(equipment).select().single()
  if (error) throw error
  return data
}

export async function updateEquipment(equipmentId, changes) {
  const { data, error } = await supabase
    .from('equipment')
    .update(changes)
    .eq('id', equipmentId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEquipment(equipmentId) {
  const { error } = await supabase.from('equipment').delete().eq('id', equipmentId)
  if (error) throw error
}

// Solo visitas que el tecnico ya trabajo: se excluyen planificada/borrador
// (todavia no las toco), quedan enviada/revision_solicitada/aprobada/rechazada.
// Trae solo lo que muestra la lista: con `*` venian las dos firmas de cada
// visita, y desde la 0030 el tecnico ve las de todo el equipo.
export async function getEquipmentVisitHistory(equipmentId) {
  const { data, error } = await supabase
    .from('visits')
    .select('id, scheduled_date, service_type, status, route_sheets(route_sheet_technicians(profiles(id, full_name)))')
    .eq('equipment_id', equipmentId)
    .not('status', 'in', `(${VISIT_STATUS.PLANIFICADA},${VISIT_STATUS.BORRADOR})`)
    .order('scheduled_date', { ascending: false })
  if (error) throw error
  return data.map(normalizeVisit)
}
