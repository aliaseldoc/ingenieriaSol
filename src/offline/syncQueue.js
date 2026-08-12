// Cola de escrituras pendientes del formulario de visita, modelo "ultima
// escritura gana por visita" (ver plan): saveVisitDraft/submitVisitForReview
// y saveVisitParameters son todas escrituras de estado absoluto, no
// incrementales, asi que alcanza con guardar el ultimo snapshot pendiente
// por visitId en vez de un log de operaciones a repetir en orden.
import { STORES, getAll, getByKey, putValue, deleteByKey, countAll } from './db'
import { isOnline, isNetworkError } from './network'
import {
  updateCachedVisit,
  cacheVisit,
  saveVisitParametersToCache,
  formSnapshotToVisitColumns,
  statusColumnsForKind,
  parameterValuesToRows,
} from './routeSheetCache'
import { saveVisitParameters, saveVisitDraft, submitVisitForReview, getVisitById } from '../api/visits'
import { VISIT_STATUS } from '../lib/constants'

export const syncQueueEvents = new EventTarget()

function emitChange() {
  syncQueueEvents.dispatchEvent(new Event('change'))
}

async function markPendingWriteError(visitId, message) {
  const entry = await getByKey(STORES.PENDING_WRITES, visitId)
  if (!entry) return
  await putValue(STORES.PENDING_WRITES, { ...entry, attempts: (entry.attempts ?? 0) + 1, lastError: message })
}

// Encola (o pisa, si ya habia una) el guardado de una visita, y refleja el
// cambio de una vez en el cache de lectura para que MonthlyPlanPage y una
// eventual reapertura del formulario vean el dato recien guardado sin
// esperar a que sincronice de verdad.
export async function queueVisitSave({ visitId, kind, formSnapshot, parameterValues, actorId, equipment }) {
  const entry = {
    visitId,
    kind,
    formSnapshot,
    parameterValues,
    actorId,
    equipment,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }
  await putValue(STORES.PENDING_WRITES, entry)
  await updateCachedVisit(visitId, { ...formSnapshotToVisitColumns(formSnapshot), ...statusColumnsForKind(kind) })
  await saveVisitParametersToCache(visitId, parameterValuesToRows(visitId, parameterValues, equipment))
  emitChange()
  return entry
}

export async function getPendingCount() {
  return countAll(STORES.PENDING_WRITES)
}

export async function getPendingWrites() {
  return getAll(STORES.PENDING_WRITES)
}

export async function getPendingWriteForVisit(visitId) {
  if (!visitId) return null
  const entry = await getByKey(STORES.PENDING_WRITES, visitId)
  return entry ?? null
}

export async function removePendingWrite(visitId) {
  await deleteByKey(STORES.PENDING_WRITES, visitId)
  emitChange()
}

// Punto de entrada unico para VisitFormPage: intenta guardar en vivo: si
// falla por red (o si ya se sabe que estamos offline), encola en vez de
// propagar el error.
export async function saveVisitOrQueue({ visitId, kind, formSnapshot, parameterValues, actorId, equipment }) {
  if (!isOnline()) {
    await queueVisitSave({ visitId, kind, formSnapshot, parameterValues, actorId, equipment })
    return { queued: true }
  }
  try {
    await saveVisitParameters(visitId, parameterValues, equipment)
    if (kind === 'submit') await submitVisitForReview(visitId, formSnapshot, actorId)
    else await saveVisitDraft(visitId, formSnapshot)

    // Ya se sincronizo en vivo: si habia una entrada vieja en la cola para
    // esta visita (ej. un borrador previo que se habia quedado pendiente),
    // queda obsoleta.
    await removePendingWrite(visitId)
    await updateCachedVisit(visitId, { ...formSnapshotToVisitColumns(formSnapshot), ...statusColumnsForKind(kind) })
    return { queued: false }
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await queueVisitSave({ visitId, kind, formSnapshot, parameterValues, actorId, equipment })
    return { queued: true }
  }
}

// Recorre la cola y reintenta cada entrada. Por cada una, despues de
// escribir, relee la visita para VERIFICAR que el cambio se aplico de
// verdad: un UPDATE que la politica RLS rechaza (ej. la visita cambio de
// estado en el servidor mientras el tecnico estaba offline) no tira error,
// Postgrest devuelve exito con 0 filas afectadas. Sin esta relectura, un
// conflicto asi se "sincronizaria" en silencio sin haber cambiado nada.
export async function flushPendingWrites({ onProgress } = {}) {
  const entries = await getPendingWrites()
  const succeeded = []
  const failed = []

  for (const entry of entries) {
    if (!isOnline()) {
      failed.push({ visitId: entry.visitId, reason: 'offline' })
      continue
    }

    const attemptStartedAt = new Date()
    try {
      await saveVisitParameters(entry.visitId, entry.parameterValues, entry.equipment)
      if (entry.kind === 'submit') await submitVisitForReview(entry.visitId, entry.formSnapshot, entry.actorId)
      else await saveVisitDraft(entry.visitId, entry.formSnapshot)
    } catch (error) {
      if (isNetworkError(error)) {
        // Se corto la conexion a mitad del flush: se deja la entrada tal
        // cual (sin marcar error) para reintentar en el proximo sync.
        failed.push({ visitId: entry.visitId, reason: 'offline' })
        onProgress?.({ visitId: entry.visitId, status: 'offline' })
        continue
      }
      const message = error?.message ?? 'Error desconocido al sincronizar'
      await markPendingWriteError(entry.visitId, message)
      failed.push({ visitId: entry.visitId, reason: message })
      onProgress?.({ visitId: entry.visitId, status: 'error' })
      continue
    }

    let fresh = null
    try {
      fresh = await getVisitById(entry.visitId)
    } catch {
      // La visita ya no es visible para este tecnico (ej. reasignada): se
      // trata igual que un conflicto, no como exito silencioso.
      fresh = null
    }

    const expectedStatus = entry.kind === 'submit' ? VISIT_STATUS.ENVIADA : VISIT_STATUS.BORRADOR
    const timestampField = entry.kind === 'submit' ? 'submitted_at' : 'draft_saved_at'
    const wasApplied =
      fresh?.status === expectedStatus && fresh?.[timestampField] && new Date(fresh[timestampField]) >= attemptStartedAt

    if (!wasApplied) {
      await markPendingWriteError(entry.visitId, 'conflict')
      failed.push({ visitId: entry.visitId, reason: 'conflict' })
      onProgress?.({ visitId: entry.visitId, status: 'conflict' })
      continue
    }

    await cacheVisit(fresh)
    await removePendingWrite(entry.visitId)
    succeeded.push(entry.visitId)
    onProgress?.({ visitId: entry.visitId, status: 'synced' })
  }

  emitChange()
  return { succeeded, failed, remaining: await getPendingCount() }
}
