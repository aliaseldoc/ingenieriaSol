import { useAsync } from './useVisits'
import { listRepairs, listRepairEvents } from '../api/repairs'

export function useRepairs() {
  return useAsync(listRepairs, [])
}

export function useRepairEvents(repairId) {
  return useAsync(() => (repairId ? listRepairEvents(repairId) : Promise.resolve([])), [repairId])
}
