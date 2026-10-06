import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { bulkAssignRouteSheets } from '../../api/routeSheets'
import { formatDate } from '../../lib/dateUtils'
import { getRouteSheetLabel, getRouteSheetSubtitle } from '../../lib/visitColor'

export default function BulkAssignModal({ open, routeSheets, technicians, vehicles, onClose, onSaved }) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [technicianIds, setTechnicianIds] = useState(new Set())
  const [vehicleId, setVehicleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedIds(new Set())
    setTechnicianIds(new Set())
    setVehicleId('')
    setSaving(false)
    setErrorMessage('')
  }, [open])

  function toggleRouteSheet(id) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllRouteSheets() {
    setSelectedIds((current) => (current.size === routeSheets.length ? new Set() : new Set(routeSheets.map((rs) => rs.id))))
  }

  function toggleTechnician(technicianId) {
    setTechnicianIds((current) => {
      const next = new Set(current)
      if (next.has(technicianId)) next.delete(technicianId)
      else next.add(technicianId)
      return next
    })
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    try {
      const selected = routeSheets.filter((routeSheet) => selectedIds.has(routeSheet.id))
      await bulkAssignRouteSheets(selected, { technicianIds: Array.from(technicianIds), vehicleId: vehicleId || null })
      onSaved()
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo completar la asignación.')
    } finally {
      setSaving(false)
    }
  }

  const allSelected = routeSheets.length > 0 && selectedIds.size === routeSheets.length

  return (
    <Modal
      open={open}
      title="Asignar Varias Hojas de Ruta"
      onClose={saving ? () => {} : onClose}
      size="lg"
      actions={[
        { label: 'Cancelar', variant: 'secondary-outline', onClick: onClose, disabled: saving },
        {
          label: saving ? 'Guardando…' : 'Asignar Seleccionadas',
          variant: 'primary',
          type: 'submit',
          form: 'bulk-assign-form',
          disabled: saving || selectedIds.size === 0 || technicianIds.size === 0,
        },
      ]}
    >
      <form id="bulk-assign-form" onSubmit={handleSave} className="h-full flex flex-col gap-md">
        {routeSheets.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No hay hojas de ruta sin asignar.</p>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-xs">
            <div className="shrink-0 flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-on-surface block">
                Hojas de Ruta ({selectedIds.size}/{routeSheets.length})
              </label>
              <button
                type="button"
                onClick={toggleAllRouteSheets}
                className="font-label-sm text-label-sm text-secondary hover:text-secondary-container transition-colors"
              >
                {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>
            <div className="flex-1 min-h-0 border border-outline-variant rounded divide-y divide-outline-variant/50 overflow-y-auto">
              {routeSheets.map((routeSheet) => {
                const label = getRouteSheetLabel(routeSheet)

                return (
                  <label
                    key={routeSheet.id}
                    className="flex items-center gap-sm p-sm cursor-pointer hover:bg-surface-container-low"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(routeSheet.id)}
                      onChange={() => toggleRouteSheet(routeSheet.id)}
                      className="w-[1.6rem] h-[1.6rem] rounded border-outline shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md text-on-surface truncate">{label}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {getRouteSheetSubtitle(routeSheet)}
                      </p>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                      {routeSheet.scheduled_date ? formatDate(routeSheet.scheduled_date) : 'Sin fecha'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="shrink-0 space-y-xs">
          <label className="font-label-sm text-label-sm text-on-surface block">Técnicos</label>
          {technicians.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">No hay técnicos disponibles.</p>
          ) : (
            // 5 filas visibles (~3.6rem cada una) y despues scroll.
            <div className="border border-outline-variant rounded divide-y divide-outline-variant/50 max-h-[18rem] overflow-y-auto">
              {technicians.map((technician) => (
                <label key={technician.id} className="flex items-center gap-sm p-sm cursor-pointer hover:bg-surface-container-low">
                  <input
                    type="checkbox"
                    checked={technicianIds.has(technician.id)}
                    onChange={() => toggleTechnician(technician.id)}
                    className="w-[1.6rem] h-[1.6rem] rounded border-outline"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface">{technician.full_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-xs">
          <label className="font-label-sm text-label-sm text-on-surface block">Vehículo</label>
          <select
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
          >
            <option value="">Sin asignar</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} — {vehicle.name}</option>
            ))}
          </select>
        </div>

        <p className="shrink-0 font-body-sm text-body-sm text-on-surface-variant">
          La fecha y hora de cada hoja de ruta seleccionada no se modifica.
        </p>

        {errorMessage && (
          <p role="alert" className="shrink-0 font-body-sm text-body-sm text-error">
            {errorMessage}
          </p>
        )}
      </form>
    </Modal>
  )
}
