import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import TaskCard from './TaskCard'
import { formatFullDate } from '../../lib/dateUtils'

// Sin onNewRouteSheet (calendario de solo lectura) no hay boton para crear.
// Las tarjetas no se arrastran: el modal tapa la grilla, no hay donde soltarlas.
export default function DayDetailModal({ date, routeSheets, onClose, onSelectRouteSheet, onNewRouteSheet = null }) {
  return (
    <Modal
      open={Boolean(date)}
      title={date ? formatFullDate(date) : ''}
      onClose={onClose}
      size="lg-auto"
      actions={onNewRouteSheet ? [{ label: 'Nueva Hoja de Ruta', variant: 'primary', icon: 'add', onClick: () => onNewRouteSheet(date) }] : []}
    >
      {routeSheets.length === 0 ? (
        <EmptyState icon="event_available" title="Sin hojas de ruta" description="Este día no tiene hojas de ruta programadas." />
      ) : (
        <div className="flex flex-col gap-sm">
          {routeSheets.map((routeSheet) => (
            <TaskCard key={routeSheet.id} routeSheet={routeSheet} onClick={onSelectRouteSheet} draggable={false} />
          ))}
        </div>
      )}
    </Modal>
  )
}
