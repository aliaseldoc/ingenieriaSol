import { VISIT_STATUS } from './constants'
import { daysBetween, parseDateInput } from './dateUtils'

// Una visita ya tiene datos reales del tecnico (fue enviada o esta en un
// estado posterior a planificada/borrador) y por lo tanto no se puede
// quitar de su hoja de ruta ni la hoja de ruta se puede eliminar sin
// perder ese historial.
export function isVisitLocked(visit) {
  return Boolean(visit.submitted_at) || ![VISIT_STATUS.PLANIFICADA, VISIT_STATUS.BORRADOR].includes(visit.status)
}

export function hasLockedVisits(routeSheet) {
  return (routeSheet?.visits ?? []).some(isVisitLocked)
}

// Mismo esquema de 4 colores, pero agregado sobre las visitas (equipos)
// que agrupa una hoja de ruta: verde solo si todas estan aprobadas, rojo
// si alguna quedo vencida sin que el tecnico la enviara.
export function getRouteSheetColor(routeSheet, today = new Date()) {
  const visits = routeSheet.visits ?? []
  const hasTechnicians = (routeSheet.technicians?.length ?? 0) > 0

  if (visits.length > 0 && visits.every((visit) => visit.status === VISIT_STATUS.APROBADA)) return 'verde'

  const isOverdue =
    hasTechnicians && routeSheet.scheduled_date && daysBetween(today, parseDateInput(routeSheet.scheduled_date)) < 0
  const hasUnsubmittedVisit = visits.some((visit) => !isVisitLocked(visit))
  if (isOverdue && hasUnsubmittedVisit) return 'rojo'

  if (hasTechnicians) return 'amarillo'

  return 'blanco'
}

// Titulo a mostrar para una hoja de ruta sin "Descripcion" cargada: antes
// caia en "N equipos" (poco representativo), ahora agrupa por cliente para
// que se pueda reconocer de un vistazo aunque el administrativo nunca haya
// escrito una descripcion (ej. al asignar varias hojas de ruta juntas).
export function getRouteSheetLabel(routeSheet) {
  if (routeSheet.descripcion?.trim()) return routeSheet.descripcion

  const visits = routeSheet.visits ?? []
  if (visits.length === 0) return 'Sin equipos'
  if (visits.length === 1) return visits[0].equipment?.motor ?? '—'

  const clientCounts = new Map()
  for (const visit of visits) {
    const name = visit.equipment?.clients?.name
    if (!name) continue
    clientCounts.set(name, (clientCounts.get(name) ?? 0) + 1)
  }
  if (clientCounts.size === 0) return `${visits.length} equipos`

  return Array.from(clientCounts.entries())
    .map(([name, count]) => (count > 1 ? `${name} (${count})` : name))
    .join(', ')
}

export const VISIT_COLOR_CLASSES = {
  blanco: 'bg-surface-container-lowest border-outline-variant',
  amarillo: 'bg-warning-container border-warning',
  verde: 'bg-tertiary-fixed-dim/20 border-tertiary-fixed-dim',
  rojo: 'bg-error-container border-error',
}

export const VISIT_COLOR_LABELS = {
  blanco: 'Sin técnico asignado',
  amarillo: 'Técnico asignado',
  verde: 'Visita realizada',
  rojo: 'Sin reporte del técnico',
}
