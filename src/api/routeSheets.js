import { supabase } from '../lib/supabaseClient'
import { VISIT_STATUS } from '../lib/constants'
import { logVisitEvent } from './visitEvents'

const ROUTE_SHEET_SELECT =
  '*, vehicles(plate, name), route_sheet_technicians(profiles(id, full_name)), visits(id, equipment_id, status, submitted_at, service_type, equipment(motor, client_id, clients(name, active)))'

// Aplana route_sheet_technicians a un array simple technicians = [{ id, full_name }, ...].
function normalizeRouteSheet(row) {
  if (!row) return row
  const { route_sheet_technicians, ...rest } = row
  return { ...rest, technicians: (route_sheet_technicians ?? []).map((rst) => rst.profiles).filter(Boolean) }
}

export async function listRouteSheetsInRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('route_sheets')
    .select(ROUTE_SHEET_SELECT)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_time_start', { ascending: true })
  if (error) throw error
  return data.map(normalizeRouteSheet)
}

export async function listUnassignedRouteSheets() {
  const { data, error } = await supabase
    .from('route_sheets')
    .select(ROUTE_SHEET_SELECT)
    .is('scheduled_date', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(normalizeRouteSheet)
}

// visits.scheduled_date es una copia sincronizada de route_sheets.scheduled_date
// (ver decision en el plan) — cualquier cambio de fecha de la hoja de ruta se
// propaga a todas sus visitas hijas para que el resto del codigo (que sigue
// filtrando/ordenando visitas por su propia columna scheduled_date) no note
// la diferencia.
async function syncVisitDates(routeSheetId, scheduledDate) {
  const { error } = await supabase.from('visits').update({ scheduled_date: scheduledDate }).eq('route_sheet_id', routeSheetId)
  if (error) throw error
}

export async function createRouteSheetWithVisits({ equipmentIds, serviceType, scheduledDate, descripcion, visitOccurrence, createdBy }) {
  const { data: routeSheet, error: routeSheetError } = await supabase
    .from('route_sheets')
    .insert({
      service_type: serviceType,
      scheduled_date: scheduledDate,
      descripcion: descripcion || null,
      visit_occurrence: visitOccurrence || null,
      created_by: createdBy,
    })
    .select()
    .single()
  if (routeSheetError) throw routeSheetError

  const rows = equipmentIds.map((equipmentId) => ({
    equipment_id: equipmentId,
    route_sheet_id: routeSheet.id,
    service_type: serviceType,
    scheduled_date: scheduledDate,
    is_annual_service: false,
    status: VISIT_STATUS.PLANIFICADA,
    created_by: createdBy,
  }))
  const { data: visits, error: visitsError } = await supabase.from('visits').insert(rows).select()
  if (visitsError) throw visitsError

  await Promise.all(visits.map((visit) => logVisitEvent(visit.id, 'creada', createdBy)))
  return { routeSheet, visits }
}

// Crea una hoja de ruta nueva por cada fila (equipos + fecha ya resueltos
// por el llamador, ver ReplicatePlanModal). Secuencial para no disparar
// insercciones concurrentes contra Supabase. Como no se llama a
// updateRouteSheetAssignment ni a setRouteSheetTechnicians, las hojas
// quedan sin tecnico ni vehiculo asignado.
export async function replicateRouteSheets(rows, createdBy) {
  const created = []
  for (const row of rows) {
    const { routeSheet } = await createRouteSheetWithVisits({
      equipmentIds: row.equipmentIds,
      serviceType: row.serviceType,
      scheduledDate: row.date,
      descripcion: row.descripcion,
      visitOccurrence: row.visitOccurrence,
      createdBy,
    })
    created.push(routeSheet)
  }
  return created
}

// Reemplaza el conjunto completo de tecnicos asignados a una hoja de ruta.
export async function setRouteSheetTechnicians(routeSheetId, technicianIds) {
  const { error: deleteError } = await supabase
    .from('route_sheet_technicians')
    .delete()
    .eq('route_sheet_id', routeSheetId)
  if (deleteError) throw deleteError
  if (!technicianIds || technicianIds.length === 0) return
  const rows = technicianIds.map((technicianId) => ({ route_sheet_id: routeSheetId, technician_id: technicianId }))
  const { error: insertError } = await supabase.from('route_sheet_technicians').insert(rows)
  if (insertError) throw insertError
}

// Guardado completo desde el popover de asignacion: tecnicos, vehiculo,
// fecha y hora de toda la hoja de ruta de una vez.
export async function updateRouteSheetAssignment(routeSheetId, { technicianIds, vehicleId, scheduledDate, scheduledTimeStart }) {
  // Sin .select().single(): ninguno de los llamadores usa la fila devuelta,
  // y pedirla de vuelta agrega un round-trip de lectura (sujeto a la policy
  // de SELECT ademas de la de UPDATE) que puede fallar con 406 sin motivo
  // real para el caso de uso.
  const { error } = await supabase
    .from('route_sheets')
    .update({ vehicle_id: vehicleId, scheduled_date: scheduledDate, scheduled_time_start: scheduledTimeStart })
    .eq('id', routeSheetId)
  if (error) throw error

  await setRouteSheetTechnicians(routeSheetId, technicianIds ?? [])
  await syncVisitDates(routeSheetId, scheduledDate)
}

// Asigna el mismo tecnico(s) y vehiculo a varias hojas de ruta de una vez
// (ver BulkAssignModal), sin tocar la fecha/hora que cada una ya tenia.
export async function bulkAssignRouteSheets(routeSheets, { technicianIds, vehicleId }) {
  for (const routeSheet of routeSheets) {
    await updateRouteSheetAssignment(routeSheet.id, {
      technicianIds,
      vehicleId,
      scheduledDate: routeSheet.scheduled_date,
      scheduledTimeStart: routeSheet.scheduled_time_start,
    })
  }
}

// Reprograma solo la fecha (usado por el arrastre en la vista semana) sin
// tocar tecnicos/vehiculo ya asignados.
export async function rescheduleRouteSheet(routeSheetId, scheduledDate, scheduledTimeStart) {
  const { error } = await supabase
    .from('route_sheets')
    .update({ scheduled_date: scheduledDate, scheduled_time_start: scheduledTimeStart })
    .eq('id', routeSheetId)
  if (error) throw error
  await syncVisitDates(routeSheetId, scheduledDate)
}

// Edita el contenido de una hoja de ruta ya creada: que equipos agrupa,
// tipo de servicio y fecha. Los equipos que se agregan generan una visita
// nueva; los que se quitan borran su visita (la UI ya impide destildar un
// equipo cuyo tecnico ya envio su reporte, para no perder ese historial).
export async function updateRouteSheetDetails(routeSheetId, { equipmentIds, serviceType, scheduledDate, descripcion, visitOccurrence, createdBy }) {
  const { data: routeSheet, error: routeSheetError } = await supabase
    .from('route_sheets')
    .update({
      service_type: serviceType,
      scheduled_date: scheduledDate,
      descripcion: descripcion || null,
      visit_occurrence: visitOccurrence || null,
    })
    .eq('id', routeSheetId)
    .select()
    .single()
  if (routeSheetError) throw routeSheetError

  const { data: currentVisits, error: currentVisitsError } = await supabase
    .from('visits')
    .select('id, equipment_id, submitted_at')
    .eq('route_sheet_id', routeSheetId)
  if (currentVisitsError) throw currentVisitsError

  const nextEquipmentIds = new Set(equipmentIds)
  const currentEquipmentIds = new Set(currentVisits.map((visit) => visit.equipment_id))
  const toAdd = equipmentIds.filter((equipmentId) => !currentEquipmentIds.has(equipmentId))
  const toRemove = currentVisits.filter((visit) => !nextEquipmentIds.has(visit.equipment_id))
  const toUpdate = currentVisits.filter((visit) => nextEquipmentIds.has(visit.equipment_id) && !visit.submitted_at)

  if (toRemove.length > 0) {
    const { error } = await supabase.from('visits').delete().in('id', toRemove.map((visit) => visit.id))
    if (error) throw error
  }

  if (toUpdate.length > 0) {
    const { error } = await supabase
      .from('visits')
      .update({ service_type: serviceType })
      .in('id', toUpdate.map((visit) => visit.id))
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map((equipmentId) => ({
      equipment_id: equipmentId,
      route_sheet_id: routeSheetId,
      service_type: serviceType,
      scheduled_date: scheduledDate,
      is_annual_service: false,
      status: VISIT_STATUS.PLANIFICADA,
      created_by: createdBy,
    }))
    const { data: newVisits, error } = await supabase.from('visits').insert(rows).select()
    if (error) throw error
    await Promise.all(newVisits.map((visit) => logVisitEvent(visit.id, 'creada', createdBy)))
  }

  await syncVisitDates(routeSheetId, scheduledDate)

  return routeSheet
}

// Borra la hoja de ruta y sus visitas. Solo se debe invocar cuando ninguna
// de esas visitas ya tiene reporte del tecnico (ver hasLockedVisits en
// lib/visitColor.js) — la UI oculta esta accion en caso contrario.
export async function deleteRouteSheet(routeSheetId) {
  const { error: visitsError } = await supabase.from('visits').delete().eq('route_sheet_id', routeSheetId)
  if (visitsError) throw visitsError
  const { error } = await supabase.from('route_sheets').delete().eq('id', routeSheetId)
  if (error) throw error
}
