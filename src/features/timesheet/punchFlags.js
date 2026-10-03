// Marcas que se muestran junto a cada fichaje y en cada celda de la grilla
// semanal. La de "fuera de rango" solo se calcula si se pasa la
// configuracion de la fabrica (el tecnico nunca la recibe).
import { LOCATION_STATUS, PUNCH_SOURCE } from '../../lib/constants'
import { getFactoryRange } from './geo'
import { DAY_STATUS } from './computeTimesheet'

export function getPunchFlags(punch, factorySettings = null) {
  const range = factorySettings ? getFactoryRange(punch, factorySettings) : null
  return {
    withoutLocation: punch.source === PUNCH_SOURCE.APP && punch.location_status === LOCATION_STATUS.SIN_UBICACION,
    offline: Boolean(punch.recorded_offline),
    manual: punch.source === PUNCH_SOURCE.MANUAL,
    afterClose: Boolean(punch.arrived_after_close),
    range,
    outOfRange: Boolean(range?.outOfRange),
  }
}

// Resumen de un dia: los anulados solo cuentan como "corregido a mano".
export function getDayFlags(dayPunches, factorySettings = null) {
  const flags = { withoutLocation: false, offline: false, manual: false, afterClose: false, outOfRange: false }
  for (const punch of dayPunches) {
    if (punch.voided_at) {
      flags.manual = true
      continue
    }
    const punchFlags = getPunchFlags(punch, factorySettings)
    flags.withoutLocation ||= punchFlags.withoutLocation
    flags.offline ||= punchFlags.offline
    flags.manual ||= punchFlags.manual
    flags.afterClose ||= punchFlags.afterClose
    flags.outOfRange ||= punchFlags.outOfRange
  }
  return flags
}

export const DAY_FLAG_DEFINITIONS = [
  { key: 'withoutLocation', icon: 'location_off', label: 'Sin ubicación' },
  { key: 'offline', icon: 'cloud_off', label: 'Registrado sin conexión' },
  { key: 'manual', icon: 'edit_note', label: 'Con corrección manual' },
  { key: 'outOfRange', icon: 'wrong_location', label: 'Fichado fuera de rango' },
  { key: 'afterClose', icon: 'lock_clock', label: 'Llegó con la semana cerrada' },
]

// Filtros de la grilla semanal. Tambien los usan los accesos directos de las
// alertas del Panel de Control (?filtro=...).
export const WEEK_FILTER = {
  TODOS: 'todos',
  INCOMPLETOS: 'incompletos',
  SIN_UBICACION: 'sin_ubicacion',
  SIN_CONEXION: 'sin_conexion',
  FUERA_DE_RANGO: 'fuera_de_rango',
  SEMANA_CERRADA: 'semana_cerrada',
}

export const WEEK_FILTER_LABELS = {
  [WEEK_FILTER.TODOS]: 'Todo el personal',
  [WEEK_FILTER.INCOMPLETOS]: 'Con fichajes incompletos',
  [WEEK_FILTER.SIN_UBICACION]: 'Con fichajes sin ubicación',
  [WEEK_FILTER.SIN_CONEXION]: 'Con fichajes sin conexión',
  [WEEK_FILTER.FUERA_DE_RANGO]: 'Con fichajes fuera de rango',
  [WEEK_FILTER.SEMANA_CERRADA]: 'Con fichajes llegados con la semana cerrada',
}

const FLAG_BY_FILTER = {
  [WEEK_FILTER.SIN_UBICACION]: 'withoutLocation',
  [WEEK_FILTER.SIN_CONEXION]: 'offline',
  [WEEK_FILTER.FUERA_DE_RANGO]: 'outOfRange',
  [WEEK_FILTER.SEMANA_CERRADA]: 'afterClose',
}

export function rowMatchesFilter(row, filter, factorySettings) {
  if (filter === WEEK_FILTER.INCOMPLETOS) return row.days.some((day) => day.status === DAY_STATUS.INCOMPLETO)
  const flagKey = FLAG_BY_FILTER[filter]
  if (!flagKey) return true
  return row.days.some((day) => getDayFlags(day.punches, factorySettings)[flagKey])
}
