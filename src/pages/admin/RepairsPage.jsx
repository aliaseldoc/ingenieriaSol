import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRepairs } from '../../hooks/useRepairs'
import { OPEN_REPAIR_STATUSES, REPAIR_STATUS, REPAIR_STATUS_LABELS } from '../../lib/constants'
import Field from '../../components/ui/Field'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import StatusChip from '../../components/ui/StatusChip'
import RepairCard from '../../features/repairs/RepairCard'
import RepairDetailPanel from '../../features/repairs/RepairDetailPanel'
import { getNextActionDueState } from '../../features/repairs/repairFormat'

const FILTERS = [
  { key: 'abiertas', label: 'Abiertas', statuses: OPEN_REPAIR_STATUSES },
  ...OPEN_REPAIR_STATUSES.map((status) => ({ key: status, label: REPAIR_STATUS_LABELS[status], statuses: [status] })),
  { key: REPAIR_STATUS.FINALIZADA, label: 'Finalizadas', statuses: [REPAIR_STATUS.FINALIZADA] },
  { key: REPAIR_STATUS.CANCELADA, label: 'Canceladas', statuses: [REPAIR_STATUS.CANCELADA] },
]

function matchesSearch(repair, term) {
  if (!term) return true
  const haystack = [repair.equipment?.clients?.name, repair.equipment?.motor, repair.equipment?.internal_code, repair.budget_number]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}

// Primero el proximo paso que vence antes; los casos sin fecha, al final y
// del mas nuevo al mas viejo.
function compareByUrgency(a, b) {
  const aDue = a.next_action && a.next_action_due ? a.next_action_due : '9999-12-31'
  const bDue = b.next_action && b.next_action_due ? b.next_action_due : '9999-12-31'
  if (aDue !== bDue) return aDue.localeCompare(bDue)
  return b.created_at.localeCompare(a.created_at)
}

// Vista compartida por supervisor y administrativo: los casos que abre
// "Reparacion Solicitada" en la validacion, con su presupuesto, estados,
// pendientes y bitacora (lo que antes se seguia en un Excel).
export default function RepairsPage() {
  const { data: repairs, loading, error, reload } = useRepairs()
  const [searchParams] = useSearchParams()
  // "Ver Reparacion" de la validacion llega con el caso recien abierto.
  const [selectedId, setSelectedId] = useState(() => searchParams.get('reparacion'))
  const [filterKey, setFilterKey] = useState('abiertas')
  const [searchTerm, setSearchTerm] = useState('')
  const detailRef = useRef(null)

  // El spinner solo en la primera carga: al guardar un cambio la lista se
  // recarga sin desmontar el detalle que se esta editando.
  if (!repairs) {
    if (loading) return <Spinner label="Cargando reparaciones…" />
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
        <EmptyState icon="error" title="No se pudieron cargar las reparaciones" description={error?.message} />
      </div>
    )
  }

  function handleSelect(repairId) {
    setSelectedId(repairId)
    // En mobile la lista y el detalle van apilados: sin esto el detalle queda
    // debajo de toda la lista y parece que no paso nada.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  const term = searchTerm.trim().toLowerCase()
  const searchedRepairs = repairs.filter((repair) => matchesSearch(repair, term))
  const activeFilter = FILTERS.find((filter) => filter.key === filterKey)
  const visibleRepairs = searchedRepairs.filter((repair) => activeFilter.statuses.includes(repair.status)).sort(compareByUrgency)
  const overdueCount = searchedRepairs.filter(
    (repair) => OPEN_REPAIR_STATUSES.includes(repair.status) && getNextActionDueState(repair)?.overdue
  ).length
  const selectedRepair = repairs.find((repair) => repair.id === selectedId) ?? null

  let emptyMessage = 'No hay reparaciones en este estado.'
  if (repairs.length === 0) emptyMessage = 'Todavía no hay reparaciones. Se abren desde Validación con "Reparación Solicitada".'
  else if (term) emptyMessage = 'Ninguna reparación coincide con la búsqueda.'

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Reparaciones</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Seguimiento de las reparaciones solicitadas en la validación de visitas: presupuesto, respuesta del cliente y
        pendientes.
      </p>

      <div className="flex flex-col md:flex-row md:items-end gap-sm mb-md">
        <Field
          label="Buscar por cliente, equipo o N° de presupuesto"
          value={searchTerm}
          onChange={setSearchTerm}
          className="w-full md:max-w-[40rem]"
        />
        {overdueCount > 0 && (
          <StatusChip label={`${overdueCount} ${overdueCount === 1 ? 'pendiente vencido' : 'pendientes vencidos'}`} tone="error" />
        )}
      </div>

      <div className="flex flex-wrap gap-xs mb-md" role="group" aria-label="Filtrar por estado">
        {FILTERS.map((filter) => {
          const count = searchedRepairs.filter((repair) => filter.statuses.includes(repair.status)).length
          const active = filter.key === filterKey
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setFilterKey(filter.key)}
              aria-pressed={active}
              className={`rounded-full border px-md py-xs font-label-sm text-label-sm transition-colors ${
                active
                  ? 'bg-secondary border-secondary text-on-secondary'
                  : 'border-outline text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {filter.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-5 space-y-sm">
          {visibleRepairs.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
              <EmptyState icon="build" title="Sin reparaciones" description={emptyMessage} />
            </div>
          ) : (
            visibleRepairs.map((repair) => (
              <RepairCard key={repair.id} repair={repair} selected={repair.id === selectedId} onSelect={handleSelect} />
            ))
          )}
        </div>
        <div ref={detailRef} className="lg:col-span-7 scroll-mt-md">
          {selectedRepair ? (
            <RepairDetailPanel key={selectedRepair.id} repair={selectedRepair} onChanged={reload} />
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
              <EmptyState
                icon="build"
                title="Seleccioná una reparación"
                description="Elegí un caso de la lista para ver su detalle y seguimiento."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
