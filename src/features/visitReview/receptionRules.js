import { VISIT_STATUS } from '../../lib/constants'

// Desde este dia la recepcion es independiente de la validacion del
// supervisor. Excepcion pedida por el usuario: las que el supervisor valido
// antes sin que nadie las recibiera (32, de cuando recien aprendian a usar el
// sistema) no cuentan como pendientes. La usan la pantalla de Recepcion y la
// cuenta de Seguimiento (countVisitsPendingReception), asi no dan distinto.
export const RECEPTION_INDEPENDENT_SINCE = new Date('2026-10-06T00:00:00-03:00')

// Pendiente de recepcion: el tecnico la envio y nadie la recibio todavia,
// la haya validado el supervisor o no. received_at es de la visita, no de
// quien mira: apenas cualquier administrativo la recibe, sale de la bandeja
// de todos.
export function isPendingReception(visit) {
  if (visit.received_at) return false
  const validatedBeforeRule =
    visit.status !== VISIT_STATUS.ENVIADA && visit.reviewed_at && new Date(visit.reviewed_at) < RECEPTION_INDEPENDENT_SINCE
  return !validatedBeforeRule
}
