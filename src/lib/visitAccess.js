import { ROLES, ROLE_HOME_PATH } from './constants'

// Desde la 0030 el tecnico puede leer las visitas de todos (calendario de
// planificacion), pero solo completa las suyas. Esta es la unica regla para
// decidir si una visita es de el: que figure entre los tecnicos de la hoja de
// ruta. Visitas y hojas de ruta llegan normalizadas con esos tecnicos en
// `technicians` (normalizeVisit, normalizeRouteSheet); el embed route_sheets
// no sobrevive a normalizeVisit, asi que no se mira ahi.
export function isAssignedTo(visitOrRouteSheet, profileId) {
  return (visitOrRouteSheet?.technicians ?? []).some((technician) => technician.id === profileId)
}

// Adonde lleva tocar una visita. Administrativo y supervisor: a su detalle.
// Tecnico: a su formulario si la visita es suya; si es de otro, al detalle de
// solo lectura del calendario. `owner` es la visita o su hoja de ruta.
export function getVisitPath(profile, visitId, owner) {
  if (profile.role !== ROLES.TECNICO) return `${ROLE_HOME_PATH[profile.role]}/visita/${visitId}`
  return isAssignedTo(owner, profile.id) ? `/tecnico/visita/${visitId}` : `/tecnico/calendario/visita/${visitId}`
}
