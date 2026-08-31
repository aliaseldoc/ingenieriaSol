import EmptyState from '../../components/ui/EmptyState'
import AlertList from './AlertList'
import { formatDate } from '../../lib/dateUtils'

const ALERT_TONE = { vencido: 'error', proximo: 'warning' }
const ALERT_LABEL = { vencido: 'Vencido', proximo: 'Próximo a Vencer' }

function toAlertItem({ item, alert }) {
  return {
    id: item.id,
    equipment: item,
    title: item.motor,
    subtitle: `${item.clients?.name} · Vence ${formatDate(alert.dueDate)}`,
    chipLabel: ALERT_LABEL[alert.alertLevel],
    chipTone: ALERT_TONE[alert.alertLevel],
  }
}

export default function AnnualServiceAlerts({ equipment, alerts, onSelectEquipment, canMute, onMute, onUnmute }) {
  const alertsByEquipmentId = new Map(alerts.map((alert) => [alert.equipmentId, alert]))

  const withAlert = equipment
    .map((item) => ({ item, alert: alertsByEquipmentId.get(item.id) }))
    .filter(({ alert }) => alert && (alert.alertLevel === 'vencido' || alert.alertLevel === 'proximo'))
    .sort((a, b) => a.alert.dueDate - b.alert.dueDate)

  return (
    <AlertList
      items={withAlert.filter(({ alert }) => !alert.muted).map(toAlertItem)}
      mutedItems={withAlert.filter(({ alert }) => alert.muted).map(toAlertItem)}
      onSelect={onSelectEquipment}
      canMute={canMute}
      onMute={onMute}
      onUnmute={onUnmute}
      emptyState={
        <EmptyState icon="task_alt" title="Sin alertas de service anual" description="Todos los equipos están al día." />
      }
    />
  )
}
