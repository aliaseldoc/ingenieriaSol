import { useAsync } from './useVisits'
import { listRouteSheetsInRange, listUnassignedRouteSheets } from '../api/routeSheets'

export function useRouteSheetsInRange(startDate, endDate) {
  return useAsync(() => listRouteSheetsInRange(startDate, endDate), [startDate, endDate])
}

// enabled = false: no consulta (el calendario de solo lectura no muestra las
// hojas sin asignar).
export function useUnassignedRouteSheets(enabled = true) {
  return useAsync(() => (enabled ? listUnassignedRouteSheets() : Promise.resolve([])), [enabled])
}
