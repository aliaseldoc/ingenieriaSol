import { useAsync } from './useVisits'
import { listPendingDeletionRequests } from '../api/deletionRequests'

export function useDeletionRequests() {
  return useAsync(listPendingDeletionRequests, [])
}
