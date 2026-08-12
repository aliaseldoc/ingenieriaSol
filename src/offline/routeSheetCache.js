// Cache de lectura offline: la hoja de ruta descargada (visitas + parametros)
// y el perfil del usuario, para que el tecnico pueda seguir viendo sus datos
// sin conexion. La cola de escrituras pendientes vive en syncQueue.js.
import { STORES, getAll, getByKey, putValue, putMany, clearStore } from './db'
import { VISIT_STATUS, VISIT_PARAMETER_DEFINITIONS, resolveSpec } from '../lib/constants'

async function getMeta(key) {
  const row = await getByKey(STORES.META, key)
  return row ? row.value : null
}

async function setMeta(key, value) {
  await putValue(STORES.META, { key, value })
}

// Mismo mapeo camelCase -> columnas que usan saveVisitDraft/submitVisitForReview
// en src/api/visits.js, para que el cache optimista quede con la misma forma
// que devuelve normalizeVisit() (nombres de columna crudos).
export function formSnapshotToVisitColumns(formSnapshot) {
  const {
    serviceType,
    checklistData,
    changesData,
    notes,
    faultReported,
    faultDescription,
    technicianSignature,
    technicianSignatureAt,
    technicianSignatureName,
    clientSignature,
    clientSignatureAt,
    clientSignatureName,
  } = formSnapshot
  return {
    service_type: serviceType,
    checklist_data: checklistData,
    changes_data: changesData,
    notes,
    fault_reported: faultReported,
    fault_description: faultDescription,
    technician_signature: technicianSignature,
    technician_signature_at: technicianSignatureAt,
    technician_signature_name: technicianSignatureName,
    client_signature: clientSignature,
    client_signature_at: clientSignatureAt,
    client_signature_name: clientSignatureName,
  }
}

// Mismo mapeo que saveVisitParameters en src/api/visits.js (objeto plano
// {clave: valor} del formulario -> filas de visit_parameters), para
// cachear los parametros encolados con la misma forma que devuelve la API.
export function parameterValuesToRows(visitId, parameterValues, equipment) {
  return VISIT_PARAMETER_DEFINITIONS.filter(
    (definition) => parameterValues[definition.key] !== '' && parameterValues[definition.key] != null
  ).map((definition) => {
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
  })
}

export function statusColumnsForKind(kind) {
  const now = new Date().toISOString()
  return kind === 'submit'
    ? { status: VISIT_STATUS.ENVIADA, submitted_at: now }
    : { status: VISIT_STATUS.BORRADOR, draft_saved_at: now }
}

// Reemplaza toda la hoja de ruta cacheada por el set fresco recien traido
// del servidor. Se llama tanto desde el boton explicito "Descargar hoja de
// ruta" como, de paso, cada vez que un fetch online tiene exito (ver
// useVisits.js) — por eso NO toca lastDownloadAt/lastDownloadCount, que
// quedan reservados a la descarga explicita (unica que ademas trae los
// parametros de todas las visitas).
export async function saveRouteSheetToCache(technicianId, visits) {
  const cachedAt = new Date().toISOString()
  await clearStore(STORES.VISITS)
  await putMany(
    STORES.VISITS,
    visits.map((visit) => ({ ...visit, _cachedAt: cachedAt }))
  )
  await setMeta('cachedTechnicianId', technicianId)
}

export async function recordRouteSheetDownload(technicianId, count) {
  await setMeta('cachedTechnicianId', technicianId)
  await setMeta('lastDownloadAt', new Date().toISOString())
  await setMeta('lastDownloadCount', count)
}

// Si el cache pertenece a otro tecnico (tablet compartida entre turnos), se
// trata como vacio en vez de mostrar datos ajenos.
export async function getCachedVisits(technicianId) {
  if (!technicianId) return []
  const cachedTechnicianId = await getMeta('cachedTechnicianId')
  if (cachedTechnicianId !== technicianId) return []
  return getAll(STORES.VISITS)
}

export async function getCachedVisit(visitId) {
  if (!visitId) return null
  const visit = await getByKey(STORES.VISITS, visitId)
  return visit ?? null
}

// Upsert de una sola visita completa (a diferencia de updateCachedVisit, que
// solo parchea una fila ya existente). Se usa para refrescar el cache "de
// paso" cuando useVisitDetail trae una visita fresca del servidor.
export async function cacheVisit(visit) {
  if (!visit?.id) return
  await putValue(STORES.VISITS, { ...visit, _cachedAt: new Date().toISOString() })
}

// Read-modify-write para reflejar en el cache de lectura una escritura que
// se acaba de encolar (o sincronizar), sin esperar al proximo fetch online.
export async function updateCachedVisit(visitId, patch) {
  const existing = await getByKey(STORES.VISITS, visitId)
  if (!existing) return
  await putValue(STORES.VISITS, { ...existing, ...patch, _cachedAt: new Date().toISOString() })
}

export async function saveVisitParametersToCache(visitId, parameterRows) {
  await putValue(STORES.VISIT_PARAMETERS, {
    visit_id: visitId,
    parameters: parameterRows,
    _cachedAt: new Date().toISOString(),
  })
}

// Agrupa un batch de filas de visit_parameters (de varias visitas) por
// visit_id, para la descarga masiva de la hoja de ruta. Escribe tambien un
// registro vacio para visitas sin parametros cargados todavia, asi
// getCachedVisitParameters no necesita distinguir "sin cache" de "sin datos".
export async function saveAllVisitParametersToCache(visitIds, rows) {
  const grouped = new Map(visitIds.map((visitId) => [visitId, []]))
  for (const row of rows) {
    if (!grouped.has(row.visit_id)) grouped.set(row.visit_id, [])
    grouped.get(row.visit_id).push(row)
  }
  const cachedAt = new Date().toISOString()
  const records = Array.from(grouped.entries()).map(([visitId, parameters]) => ({
    visit_id: visitId,
    parameters,
    _cachedAt: cachedAt,
  }))
  await putMany(STORES.VISIT_PARAMETERS, records)
}

export async function getCachedVisitParameters(visitId) {
  if (!visitId) return []
  const row = await getByKey(STORES.VISIT_PARAMETERS, visitId)
  return row ? row.parameters : []
}

// IDs de visita que tienen fila en el cache de parametros (se escribe una
// por cada visita al descargar la hoja de ruta, incluso vacia si no tiene
// parametros — ver saveAllVisitParametersToCache). Sirve como indicador de
// "esta visita puntual ya quedo disponible sin conexion", sin importar si
// llego ahi por la descarga explicita o por abrir esa visita online alguna
// vez (useVisitParameters tambien cachea al vuelo).
export async function getDownloadedVisitIds() {
  const rows = await getAll(STORES.VISIT_PARAMETERS)
  return rows.map((row) => row.visit_id)
}

export async function getLastDownloadInfo() {
  const downloadedAt = await getMeta('lastDownloadAt')
  if (!downloadedAt) return null
  const count = await getMeta('lastDownloadCount')
  const technicianId = await getMeta('cachedTechnicianId')
  return { downloadedAt, count: count ?? 0, technicianId }
}

export async function clearRouteSheetCache() {
  await clearStore(STORES.VISITS)
  await clearStore(STORES.VISIT_PARAMETERS)
}

// Fallback de sesion offline (ver AuthContext.jsx): si getProfile() falla
// por falta de red, se usa el ultimo perfil conocido en vez de cerrar sesion.
export async function cacheProfile(profile) {
  await setMeta('cachedProfile', profile)
}

export async function getCachedProfile() {
  return getMeta('cachedProfile')
}
