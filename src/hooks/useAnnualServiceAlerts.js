import { useMemo } from 'react'
import { getAlertLevel, getNextAnnualServiceDue, isAnnualAlertMuted } from '../lib/dateUtils'

// Deriva, para cada equipo, la fecha del proximo service anual, su nivel de
// alerta y si el supervisor la silencio.
export function useAnnualServiceAlerts(equipmentList) {
  return useMemo(() => {
    const today = new Date()
    return equipmentList.map((item) => {
      const dueDate = getNextAnnualServiceDue(item)
      return {
        equipmentId: item.id,
        dueDate,
        alertLevel: getAlertLevel(dueDate, today),
        muted: isAnnualAlertMuted(item, dueDate),
      }
    })
  }, [equipmentList])
}
