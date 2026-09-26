import { REPAIR_STATUS_LABELS, REPAIR_STATUS_TONE } from '../../lib/constants'
import StatusChip from '../../components/ui/StatusChip'
import { formatCurrency, formatDaysAgo, getNextActionDueState } from './repairFormat'

export default function RepairCard({ repair, selected, onSelect }) {
  const dueState = getNextActionDueState(repair)
  // listRepairs trae solo el ultimo evento de la bitacora.
  const lastActivity = repair.repair_events?.[0]?.created_at ?? repair.created_at
  const equipmentName = [repair.equipment?.motor, repair.equipment?.generador].filter(Boolean).join(' ')
  const budgetSummary = [
    repair.budget_number && `N° ${repair.budget_number}`,
    repair.budget_amount != null && formatCurrency(repair.budget_amount),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={() => onSelect(repair.id)}
      aria-pressed={selected}
      className={`w-full text-left bg-surface-container-lowest border rounded-lg p-md space-y-xs transition-colors ${
        selected ? 'border-secondary ring-2 ring-secondary' : 'border-outline-variant hover:border-secondary'
      }`}
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-on-surface">{repair.equipment?.clients?.name ?? 'Sin cliente'}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{equipmentName || 'Equipo sin datos'}</p>
        </div>
        <StatusChip label={REPAIR_STATUS_LABELS[repair.status]} tone={REPAIR_STATUS_TONE[repair.status]} variant="tag" />
      </div>

      {repair.next_action && (
        <div className="flex flex-wrap items-center gap-xs">
          <p className={`font-body-sm text-body-sm ${dueState?.overdue ? 'text-error' : 'text-on-surface'}`}>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Próximo paso:</span> {repair.next_action}
          </p>
          {dueState && <StatusChip label={dueState.label} tone={dueState.tone} variant="tag" />}
        </div>
      )}

      {budgetSummary && <p className="font-body-sm text-body-sm text-on-surface-variant">Presupuesto {budgetSummary}</p>}

      <p className="font-label-sm text-label-sm text-on-surface-variant">Última novedad: {formatDaysAgo(lastActivity)}</p>
    </button>
  )
}
