// Envoltorio fino y generico sobre IndexedDB nativo (sin librerias externas).
// Unico archivo que llama a `indexedDB.*` directamente; el resto de
// src/offline/* pasa siempre por estos helpers.

const DB_NAME = 'isol-offline'
// v2: store de fichajes pendientes (ver punchQueue.js). onupgradeneeded
// solo crea los stores que faltan, asi que subir la version no toca los datos
// ya guardados de las visitas.
const DB_VERSION = 2

export const STORES = {
  VISITS: 'visits',
  VISIT_PARAMETERS: 'visitParameters',
  PENDING_WRITES: 'pendingWrites',
  PENDING_PUNCHES: 'pendingPunches',
  META: 'meta',
}

const STORE_KEY_PATHS = {
  [STORES.VISITS]: 'id',
  [STORES.VISIT_PARAMETERS]: 'visit_id',
  [STORES.PENDING_WRITES]: 'visitId',
  [STORES.PENDING_PUNCHES]: 'id',
  [STORES.META]: 'key',
}

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const [storeName, keyPath] of Object.entries(STORE_KEY_PATHS)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Ejecuta `callback` contra el store dentro de una transaccion y espera a
// que la transaccion termine de verdad (no solo a que resuelva la ultima
// request) antes de devolver el resultado.
async function withStore(storeName, mode, callback) {
  const db = await openDb()
  const transaction = db.transaction(storeName, mode)
  const store = transaction.objectStore(storeName)
  const result = await callback(store)
  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  return result
}

export async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => promisifyRequest(store.getAll()))
}

export async function getByKey(storeName, key) {
  return withStore(storeName, 'readonly', (store) => promisifyRequest(store.get(key)))
}

export async function putValue(storeName, value) {
  return withStore(storeName, 'readwrite', (store) => promisifyRequest(store.put(value)))
}

// Une todas las escrituras en una sola transaccion (o se aplican todas o
// ninguna), en vez de N transacciones independientes.
export async function putMany(storeName, values) {
  return withStore(storeName, 'readwrite', (store) => {
    for (const value of values) store.put(value)
  })
}

export async function deleteByKey(storeName, key) {
  return withStore(storeName, 'readwrite', (store) => promisifyRequest(store.delete(key)))
}

export async function clearStore(storeName) {
  return withStore(storeName, 'readwrite', (store) => promisifyRequest(store.clear()))
}

export async function countAll(storeName) {
  return withStore(storeName, 'readonly', (store) => promisifyRequest(store.count()))
}

// Best-effort: le pide al navegador que no elimine este storage bajo
// presion de espacio. No hay soporte garantizado (Safari lo ignora), por
// eso nunca se espera ni se falla si no esta disponible.
export async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Ignorado a proposito: es una mejora de best-effort, no un requisito.
  }
}
