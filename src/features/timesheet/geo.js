// Distancia entre un fichaje por app y la fabrica, para la leyenda
// "Fichado fuera de rango" que ve el supervisor.
//
// La ubicacion de la persona es privada: la base calcula la distancia al
// fichar y descarta las coordenadas (migracion 0026). Aca no hay coordenadas
// que leer, solo esa distancia contra el radio configurado. Por lo mismo, si
// cambia la ubicacion de la fabrica, los fichajes viejos conservan la
// distancia que se calculo en su momento.
import { PUNCH_SOURCE } from '../../lib/constants'

export function hasFactoryLocation(settings) {
  return settings?.factory_latitude != null && settings?.factory_longitude != null
}

// null cuando no aplica: fichaje del reloj o manual (sin ubicacion), fichaje
// sin ubicacion, o sin la fabrica cargada al momento de fichar.
export function getFactoryRange(punch, settings) {
  if (punch.source !== PUNCH_SOURCE.APP) return null
  if (punch.distance_to_factory_m == null) return null
  const distanceMeters = punch.distance_to_factory_m
  return { distanceMeters, outOfRange: settings?.factory_radius_m != null && distanceMeters > settings.factory_radius_m }
}

// 350 -> "350 m", 3200 -> "3,2 km"
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export function mapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

// Acepta lo que se copia de Google Maps: "-34.6037, -58.3816".
export function parseCoordinates(text) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text ?? '')
  if (!match) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
