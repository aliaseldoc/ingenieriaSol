// Cola de fichajes del tecnico hechos sin conexion, y cache de lectura de su
// legajo y de su semana para verlos offline (ver "Offline" en FICHAJE.md).
//
// A diferencia de la cola de visitas (una entrada por visita, "ultima
// escritura gana"), cada fichaje es un alta independiente: se guarda uno por
// id. El id lo genera el celular, asi que reintentar el insert nunca duplica:
// si el primer intento llego al servidor y se perdio la respuesta, el
// reintento choca con la clave primaria y se da por sincronizado.
import { STORES, getAll, getByKey, putValue, deleteByKey } from './db'
import { isOnline, isNetworkError } from './network'
import { syncQueueEvents } from './syncQueue'
import { insertAppPunch } from '../api/timePunches'

const DUPLICATE_KEY_CODE = '23505'
const EMPLOYEE_CACHE_KEY = 'timesheetEmployee'
const WEEK_CACHE_KEY = 'timesheetWeek'

// Mismo canal que la cola de visitas: SyncStatusBar cuenta ambas.
function emitChange() {
  syncQueueEvents.dispatchEvent(new Event('change'))
}

function isAlreadySaved(error) {
  return error?.code === DUPLICATE_KEY_CODE
}

export async function getPendingPunches() {
  return getAll(STORES.PENDING_PUNCHES)
}

async function queuePunch(punch) {
  await putValue(STORES.PENDING_PUNCHES, {
    id: punch.id,
    // Sin conexion la hora es la del celular al confirmar, y queda marcado.
    punch: { ...punch, recorded_offline: true },
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  })
  emitChange()
}

// Punto de entrada unico de PunchPage: intenta guardar en vivo y, si no hay
// red (o se corta en el intento), lo deja en la cola.
export async function savePunchOrQueue(punch) {
  if (!isOnline()) {
    await queuePunch(punch)
    return { queued: true }
  }
  try {
    await insertAppPunch({ ...punch, recorded_offline: false })
    return { queued: false }
  } catch (error) {
    if (isAlreadySaved(error)) return { queued: false }
    if (!isNetworkError(error)) throw error
    await queuePunch(punch)
    return { queued: true }
  }
}

export async function flushPendingPunches() {
  const entries = await getPendingPunches()
  for (const entry of entries) {
    if (!isOnline()) break
    try {
      await insertAppPunch(entry.punch)
    } catch (error) {
      // Se corto la red a mitad: se reintenta en el proximo sync.
      if (isNetworkError(error)) break
      if (!isAlreadySaved(error)) {
        await putValue(STORES.PENDING_PUNCHES, {
          ...entry,
          attempts: (entry.attempts ?? 0) + 1,
          lastError: error?.message ?? 'Error desconocido al sincronizar',
        })
        continue
      }
    }
    await deleteByKey(STORES.PENDING_PUNCHES, entry.id)
  }
  emitChange()
}

// El legajo se guarda junto al perfil al que pertenece: en un celular
// compartido, otro tecnico nunca ve el legajo del anterior.
export async function cacheMyEmployee(profileId, employee) {
  await putValue(STORES.META, { key: EMPLOYEE_CACHE_KEY, profileId, employee })
}

export async function getCachedMyEmployee(profileId) {
  const entry = await getByKey(STORES.META, EMPLOYEE_CACHE_KEY)
  return entry?.profileId === profileId ? entry.employee : null
}

// Ultima semana consultada con conexion (fichajes y feriados).
export async function cacheMyWeek(employeeId, weekStartKey, punches, holidayKeys) {
  await putValue(STORES.META, { key: WEEK_CACHE_KEY, employeeId, weekStartKey, punches, holidayKeys, cachedAt: new Date().toISOString() })
}

export async function getCachedMyWeek(employeeId, weekStartKey) {
  const entry = await getByKey(STORES.META, WEEK_CACHE_KEY)
  if (entry?.employeeId !== employeeId || entry?.weekStartKey !== weekStartKey) return null
  return entry
}
