import EquipmentRow from './EquipmentRow'

export default function ClientGroupRow({ client, equipmentList, expanded, onToggleExpanded, onOpenHistory }) {
  return (
    <div className="border-b border-outline-variant last:border-b-0">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="w-full flex items-center gap-sm py-sm px-sm bg-secondary hover:bg-secondary-container transition-colors text-left"
      >
        <span className="material-symbols-outlined text-[2rem] text-secondary-fixed-dim">
          {expanded ? 'expand_more' : 'chevron_right'}
        </span>
        <span className="font-label-md text-label-md text-on-secondary">{client.name}</span>
        <span className="font-label-sm text-label-sm text-secondary-fixed-dim">({equipmentList.length})</span>
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
