import EmptyState from '../../components/ui/EmptyState'
import AlertList from './AlertList'

function toAlertItem(equipment) {
  return {
    id: equipment.id,
    equipment,
    title: equipment.motor,
    subtitle: equipment.clients?.name,
    chipLabel: `${equipment.fuel_percentage}%`,
    chipTone: 'warning',
  }
}

export default function FuelAlerts({ equipment, mutedEquipment = [], onSelectEquipment, canMute, onMute, onUnmute }) {
  return (
    <AlertList
      items={equipment.map(toAlertItem)}
      mutedItems={mutedEquipment.map(toAlertItem)}
      onSelect={onSelectEquipment}
      canMute={canMute}
      onMute={onMute}
      onUnmute={onUnmute}
      emptyState={
        <EmptyState
          icon="local_gas_station"
          title="Sin alertas de combustible"
          description="Todos los equipos tienen más del 30% de combustible."
        />
      }
    />
  )
}
