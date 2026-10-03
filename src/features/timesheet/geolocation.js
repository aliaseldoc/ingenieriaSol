// Ubicacion actual del dispositivo (API nativa). Nunca rechaza: si no se
// puede obtener, devuelve el motivo, porque el fichaje igual se guarda
// marcado "sin ubicacion" (ver FICHAJE.md).
import { LOCATION_STATUS, TIMESHEET_RULES } from '../../lib/constants'

const ERROR_BY_CODE = {
  1: 'permiso_denegado',
  2: 'no_disponible',
  3: 'tiempo_agotado',
}

export function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ status: LOCATION_STATUS.SIN_UBICACION, error: 'no_disponible' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: LOCATION_STATUS.OK,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => resolve({ status: LOCATION_STATUS.SIN_UBICACION, error: ERROR_BY_CODE[error.code] ?? 'no_disponible' }),
      { enableHighAccuracy: true, timeout: TIMESHEET_RULES.geolocationTimeoutMs, maximumAge: 0 }
    )
  })
}
