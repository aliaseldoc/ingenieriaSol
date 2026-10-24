import StatusChip from '../../components/ui/StatusChip'
import { isActiveClient } from '../../lib/constants'
import EquipmentRow from './EquipmentRow'

export default function ClientGroupRow({ client, equipmentList, expanded, onToggleExpanded, onOpenHistory }) {
  return (
    <div className="border-b border-outline-variant last:border-b-0">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="w-full flex items-center gap-sm py-sm px-sm bg-bar hover:bg-bar-light transition-colors text-left"
      >
        <span className="material-symbols-outlined text-[2rem] text-on-bar/70">
          {expanded ? 'expand_more' : 'chevron_right'}
        </span>
        <span className="font-label-md text-label-md text-on-bar">{client.name}</span>
        <span className="font-label-sm text-label-sm text-on-bar/70">({equipmentList.length})</span>
        {!isActiveClient(client) && <StatusChip label="Inactivo" tone="neutral" variant="tag" />}
      </button>
      {expanded && (
        <div>
          {equipmentList.map((equipment, index) => (
            <EquipmentRow key={equipment.id} equipment={equipment} onOpenHistory={onOpenHistory} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}
