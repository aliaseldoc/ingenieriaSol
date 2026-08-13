import { supabase } from '../lib/supabaseClient'
import { VISIT_STATUS, VISIT_PARAMETER_DEFINITIONS, VISIT_CHANGE_TO_EQUIPMENT_TRACKING, resolveSpec } from '../lib/constants'
import { computeNextDueDate } from '../lib/dateUtils'
import { logVisitEvent } from './visitEvents'

const ROUTE_SHEET_EMBED = 'route_sheets(id, vehicle_id, scheduled_time_start, vehicles(plate), route_sheet_technicians(profiles(id, full_name)))'
const VISIT_SELECT = `*, equipment(internal_code, motor, generador, client_id, fuel_capacity, battery_quantity, clients(name)), ${ROUTE_SHEET_EMBED}`

// La asignacion de tecnicos/vehiculo vive en la hoja de ruta, no en la
// visita. Esto aplana ese embed anidado a la misma forma plana que ya
// usaba el resto del codigo (visit.technicians / visit.vehicles), para
// no tener que tocar los componentes que solo leen esos dos campos.
export function normalizeVisit(row) {
  if (!row) return row
  const { route_sheets, ...rest } = row
  const technicians = (route_sheets?.route_sheet_technicians ?? []).map((rst) => rst.profiles).filter(Boolean)
  return {
    ...rest,
    routeSheetId: rest.route_sheet_id,
    technicians,
    vehicles: route_sheets?.vehicles ?? null,
  }
}

export async function getVisitById(visitId) {
  const { data, error } = await supabase.from('visits').select(VISIT_SELECT).eq('id', visitId).single()
  if (error) throw error
  return normalizeVisit(data)
}

export async function listVisitsForTechnician(technicianId) {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `*, equipment(internal_code, motor, generador, client_id, fuel_capacity, battery_quantity, clients(name)), route_sheets!inner(id, vehicle_id, scheduled_time_start, vehicles(plate), route_sheet_technicians!inner(profiles(id, full_name)))`
    )
    .eq('route_sheets.route_sheet_technicians.technician_id', technicianId)
    .order('scheduled_date', { ascending: true })
  if (error) throw error
  return data.map(normalizeVisit)
}

export async function listVisitsInRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_time_start', { ascending: true })
  if (error) throw error
  return data.map(normalizeVisit)
}

export async function listUnassignedVisits() {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .is('scheduled_date', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(normalizeVisit)
}

export async function listVisitsPendingReview() {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .eq('status', VISIT_STATUS.ENVIADA)
    .order('submitted_at', { ascending: true })
  if (error) throw error
  return data.map(normalizeVisit)
}

export async function listAllSubmittedVisits() {
  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data.map(normalizeVisit)
}

export async function listVisitsThisMonth() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return listVisitsInRange(start, end)
}

// Trae los parametros de varias visitas de una sola vez (evita N+1 queries
// al descargar la hoja de ruta completa para uso offline).
export async function listVisitParametersForVisits(visitIds) {
  if (!visitIds.length) return []
  const { data, error } = await supabase.from('visit_parameters').select('*').in('visit_id', visitIds)
  if (error) throw error
  return data
}

function signatureColumns({
  technicianSignature,
  technicianSignatureAt,
  technicianSignatureName,
  clientSignature,
  clientSignatureAt,
  clientSignatureName,
}) {
  return {
    technician_signature: technicianSignature,
    technician_signature_at: technicianSignatureAt,
    technician_signature_name: technicianSignatureName,
    client_signature: clientSignature,
    client_signature_at: clientSignatureAt,
    client_signature_name: clientSignatureName,
  }
}

export async function saveVisitDraft(visitId, formSnapshot) {
  const { serviceType, checklistData, changesData, notes, faultReported, faultDescription } = formSnapshot
  const { error } = await supabase
    .from('visits')
    .update({
      service_type: serviceType,
      checklist_data: checklistData,
      changes_data: changesData,
      notes,
      fault_reported: faultReported,
      fault_description: faultDescription,
      ...signatureColumns(formSnapshot),
      status: VISIT_STATUS.BORRADOR,
      draft_saved_at: new Date().toISOString(),
    })
    .eq('id', visitId)
  if (error) throw error
}

export async function submitVisitForReview(visitId, formSnapshot, actorId) {
  const { serviceType, checklistData, changesData, notes, faultReported, faultDescription } = formSnapshot
  const { error } = await supabase
    .from('visits')
    .update({
      service_type: serviceType,
      checklist_data: checklistData,
      changes_data: changesData,
      notes,
      fault_reported: faultReported,
      fault_description: faultDescription,
      ...signatureColumns(formSnapshot),
      status: VISIT_STATUS.ENVIADA,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', visitId)
  if (error) throw error
  await logVisitEvent(visitId, 'enviada', actorId)
}

// Al recibir la visita se vuelca a la ficha del equipo lo que el tecnico
// releva en terreno (nivel de combustible, horas de uso, fecha del
// service), para que "Equipos" refleje el dato apenas el administrativo
// confirma la recepcion, sin esperar a la aprobacion del supervisor.
//
// Este es tambien el unico lugar donde se recalculan automaticamente los 4
// vencimientos de "Proximo Service" (filtros/bateria) — antes esto solo se
// editaba a mano en la ficha del equipo. Por cada campo de
// VISIT_CHANGE_TO_EQUIPMENT_TRACKING marcado "si" en changesData, se pisa su
// fecha de cambio (hoy) y se recalcula el proximo vencimiento; los campos no
// marcados "si" no se tocan.
export async function markVisitReceived(visitId, receivedBy, equipmentId, parameters, changesData, { isAnnualService } = {}) {
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('visits')
    .update({ received_by: receivedBy, received_at: nowIso })
    .eq('id', visitId)
  if (error) throw error

  const findValue = (metricKey) => (parameters ?? []).find((parameter) => parameter.metric_key === metricKey)?.value
  const fuelPercentage = findValue('nivel_combustible')
  const hoursOfUse = findValue('horas_operacion')

  const today = nowIso.slice(0, 10)
  const equipmentChanges = { last_service_date: today }
  if (fuelPercentage != null) equipmentChanges.fuel_percentage = fuelPercentage
  if (hoursOfUse != null) equipmentChanges.hours_of_use = hoursOfUse
  if (isAnnualService) equipmentChanges.last_annual_service_date = today

  for (const tracking of VISIT_CHANGE_TO_EQUIPMENT_TRACKING) {
    if (changesData?.[tracking.changeKey] !== 'si') continue
    equipmentChanges[tracking.changedAtField] = today
    equipmentChanges[tracking.nextDueField] = computeNextDueDate(today, tracking.yearsAhead)
  }

  const { error: equipmentError } = await supabase.from('equipment').update(equipmentChanges).eq('id', equipmentId)
  if (equipmentError) throw equipmentError

  await logVisitEvent(visitId, 'recibida', receivedBy)
}

export async function approveVisit(visitId, reviewedBy, reviewNotes) {
  const { error } = await supabase
    .from('visits')
    .update({ status: VISIT_STATUS.APROBADA, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_notes: reviewNotes })
    .eq('id', visitId)
  if (error) throw error
  await logVisitEvent(visitId, 'aprobada', reviewedBy, reviewNotes)
}

export async function rejectVisit(visitId, reviewedBy, reviewNotes) {
  const { error } = await supabase
    .from('visits')
    .update({ status: VISIT_STATUS.RECHAZADA, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_notes: reviewNotes })
    .eq('id', visitId)
  if (error) throw error
  await logVisitEvent(visitId, 'rechazada', reviewedBy, reviewNotes)
}

export async function requestVisitRevision(visitId, reviewedBy, reviewNotes) {
  const { error } = await supabase
    .from('visits')
    .update({ status: VISIT_STATUS.REVISION_SOLICITADA, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_notes: reviewNotes })
    .eq('id', visitId)
  if (error) throw error
  await logVisitEvent(visitId, 'revision_solicitada', reviewedBy, reviewNotes)
}

// Reemplaza los parametros cuantitativos de la visita por los valores actuales
// del formulario (el conjunto de metricas es fijo, ver VISIT_PARAMETER_DEFINITIONS).
// El rango normal (spec_min/spec_max) se resuelve segun el voltaje del
// equipo (ver resolveSpec) y se graba como snapshot en el momento de
// guardar, igual que el resto de la fila — no se recalcula retroactivamente
// si el voltaje del equipo cambia despues.
export async function saveVisitParameters(visitId, parameterValues, equipment) {
  const { error: deleteError } = await supabase.from('visit_parameters').delete().eq('visit_id', visitId)
  if (deleteError) throw deleteError

  const rows = VISIT_PARAMETER_DEFINITIONS.filter((definition) => parameterValues[definition.key] !== '' && parameterValues[definition.key] != null).map(
    (definition) => {
      const { specMin, specMax } = resolveSpec(definition, equipment)
      return {
        visit_id: visitId,
        metric_key: definition.key,
        metric_label: definition.label,
        value: Number(parameterValues[definition.key]),
        unit: definition.unit,
        spec_min: specMin,
        spec_max: specMax,
      }
    }
  )

  if (rows.length === 0) return
  const { error: insertError } = await supabase.from('visit_parameters').insert(rows)
  if (insertError) throw insertError
}
