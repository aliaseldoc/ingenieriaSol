import { useMemo } from 'react'
import { FUEL_ALERT_THRESHOLD_PERCENTAGE, isFuelAlertMuted } from '../lib/constants'

// Deriva, de la lista de equipo ya cargada, cuales tienen combustible bajo.
// Devuelve las activas y las silenciadas por separado: el panel muestra las
// primeras como alerta y deja las segundas a mano para poder reactivarlas.
export function useFuelAlerts(equipmentList) {
  return useMemo(() => {
    const belowThreshold = equipmentList
      .filter((item) => item.fuel_percentage != null && item.fuel_percentage <= FUEL_ALERT_THRESHOLD_PERCENTAGE)
      .sort((a, b) => a.fuel_percentage - b.fuel_percentage)

    return {
      active: belowThreshold.filter((item) => !isFuelAlertMuted(item)),
      muted: belowThreshold.filter((item) => isFuelAlertMuted(item)),
    }
  }, [equipmentList])
}
