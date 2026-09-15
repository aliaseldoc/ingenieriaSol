// Distancia entre un fichaje por app y la fabrica, para la leyenda
// "Fichado fuera de rango" que ve el supervisor. Funciones puras, Math nativo.
import { PUNCH_SOURCE } from '../../lib/constants'

const EARTH_RADIUS_M = 6371000

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

// Formula de haversine: distancia sobre la superficie terrestre, en metros.
export function distanceInMeters(fromLat, fromLng, toLat, toLng) {
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

export function hasFactoryLocation(settings) {
  return settings?.factory_latitude != null && settings?.factory_longitude != null
}

// null cuando no aplica: fichaje del reloj o manual (sin ubicacion), fichaje
// sin ubicacion, o fabrica todavia sin cargar.
export function getFactoryRange(punch, settings) {
  if (punch.source !== PUNCH_SOURCE.APP) return null
  if (punch.latitude == null || punch.longitude == null) return null
  if (!hasFactoryLocation(settings)) return null

  const distanceMeters = distanceInMeters(
    settings.factory_latitude,
    settings.factory_longitude,
    punch.latitude,
    punch.longitude
  )
  return { distanceMeters, outOfRange: distanceMeters > settings.factory_radius_m }
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
