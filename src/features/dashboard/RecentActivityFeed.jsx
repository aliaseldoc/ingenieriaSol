import ActivityList from '../../components/ui/ActivityList'
import { formatDateTime } from '../../lib/dateUtils'

const EVENT_ICON = {
  creada: 'add_circle',
  borrador_guardado: 'save',
  enviada: 'send',
  revision_solicitada: 'edit_note',
  recibida: 'how_to_reg',
  aprobada: 'check_circle',
  rechazada: 'cancel',
  resultados_enviados: 'mail',
  nota_supervisor: 'chat',
  reparacion_solicitada: 'build',
}

const EVENT_LABEL = {
  creada: 'Visita creada',
  borrador_guardado: 'Borrador guardado',
  enviada: 'Enviada a revisión',
  revision_solicitada: 'Revisión solicitada',
  recibida: 'Recibida',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  resultados_enviados: 'Resultados enviados por mail',
  nota_supervisor: 'Nota al técnico',
  reparacion_solicitada: 'Reparación solicitada',
}

export default function RecentActivityFeed({ events, onSelectEvent }) {
  const items = events.map((event) => ({
    id: event.id,
    visitId: event.visit_id,
    icon: EVENT_ICON[event.event_type] ?? 'radio_button_checked',
    title: `${EVENT_LABEL[event.event_type] ?? event.event_type} · ${event.visits?.equipment?.motor ?? ''}`,
    subtitle: `${event.visits?.equipment?.clients?.name ?? ''} · ${event.profiles?.full_name ?? 'Sistema'}`,
    timestamp: formatDateTime(event.created_at),
  }))

  return <ActivityList items={items} onSelect={onSelectEvent ? (item) => onSelectEvent(item.visitId) : null} />
}
