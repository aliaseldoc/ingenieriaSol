import EquipmentRow from '../equipmentInventory/EquipmentRow'

// El header tiene 2 triggers independientes (no puede haber un boton dentro
// de otro boton): el chevron expande/colapsa el listado de equipos, y el
// resto de la fila abre el popup "Detalle del Cliente" con su ficha de datos.
export default function ClientCard({ client, equipmentList, expanded, onToggleExpanded, onOpenDetail, onOpenHistory }) {
  return (
    <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest">
      <div className="w-full flex items-center gap-sm py-sm px-md bg-secondary hover:bg-secondary-container transition-colors">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpanded()
          }}
          aria-label={expanded ? 'Colapsar equipos' : 'Expandir equipos'}
          className="text-secondary-fixed-dim"
        >
          <span className="material-symbols-outlined text-[2rem]">{expanded ? 'expand_more' : 'chevron_right'}</span>
        </button>
        <button type="button" onClick={() => onOpenDetail(client)} className="flex-1 flex items-center gap-sm text-left">
          <span className="flex-1 font-label-md text-label-md text-on-secondary">{client.name}</span>
          <span className="font-label-sm text-label-sm text-secondary-fixed-dim">{equipmentList.length} equipo(s)</span>
        </button>
      </div>

      {expanded && (
        <div>
          {equipmentList.length === 0 ? (
            <p className="p-md font-body-sm text-body-sm text-on-surface-variant">
              Este cliente todavía no tiene equipos cargados.
            </p>
          ) : (
            <div>
              {equipmentList.map((equipment, index) => (
                <EquipmentRow key={equipment.id} equipment={equipment} onOpenHistory={onOpenHistory} index={index} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
