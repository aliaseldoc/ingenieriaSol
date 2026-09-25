// Toda la fila abre el pop-up "Detalle del Cliente", que tiene su ficha de
// datos y el listado de sus equipos.
export default function ClientCard({ client, equipmentCount, onOpenDetail }) {
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(client)}
      className="w-full flex items-center gap-sm py-sm px-md border border-outline-variant rounded-lg bg-secondary hover:bg-secondary-container transition-colors text-left"
    >
      <span className="flex-1 font-label-md text-label-md text-on-secondary">{client.name}</span>
      <span className="font-label-sm text-label-sm text-secondary-fixed-dim">{equipmentCount} equipo(s)</span>
    </button>
  )
}
