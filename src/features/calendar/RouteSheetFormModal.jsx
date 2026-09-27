import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Field from '../../components/ui/Field'
import { createRouteSheetWithVisits, updateRouteSheetDetails, deleteRouteSheet } from '../../api/routeSheets'
import { isVisitLocked, hasLockedVisits } from '../../lib/visitColor'
import { SERVICE_TYPE, SERVICE_TYPE_LABELS, VISIT_OCCURRENCE_LABELS, isActiveClient } from '../../lib/constants'

const EMPTY_FORM = { serviceType: SERVICE_TYPE.PREVENTIVO, scheduledDate: '', descripcion: '', visitOccurrence: '' }
const LARGE_INPUT = 'font-body-lg text-body-lg'

export default function RouteSheetFormModal({
  open,
  mode = 'create',
  routeSheet,
  clients,
  equipment,
  createdBy,
  initialDate,
  onClose,
  onSaved,
  onDeleted,
}) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedClientIds, setSelectedClientIds] = useState(new Set())
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set())
  const [lockedEquipmentIds, setLockedEquipmentIds] = useState(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) return
    if (isEdit && routeSheet) {
      const visits = routeSheet.visits ?? []
      setForm({
        serviceType: routeSheet.service_type ?? SERVICE_TYPE.PREVENTIVO,
        scheduledDate: routeSheet.scheduled_date ?? '',
        descripcion: routeSheet.descripcion ?? '',
        visitOccurrence: routeSheet.visit_occurrence ?? '',
      })
      setSelectedEquipmentIds(new Set(visits.map((visit) => visit.equipment_id)))
      setLockedEquipmentIds(new Set(visits.filter(isVisitLocked).map((visit) => visit.equipment_id)))
      setSelectedClientIds(new Set(visits.map((visit) => visit.equipment?.client_id).filter(Boolean)))
    } else {
      setForm({ ...EMPTY_FORM, scheduledDate: initialDate ?? '' })
      setSelectedClientIds(new Set())
      setSelectedEquipmentIds(new Set())
      setLockedEquipmentIds(new Set())
    }
    setConfirmingDelete(false)
    setSearchTerm('')
    setSaving(false)
    setDeleting(false)
    setErrorMessage('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, routeSheet, initialDate])

  const normalizedSearch = searchTerm.trim().toLowerCase()

  function matchesSearch(item) {
    if (!normalizedSearch) return true
    const haystack = [item.motor, item.generador].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(normalizedSearch)
  }

  // Los clientes inactivos no se ofrecen para planificar. Al editar, los que
  // ya tienen equipos en esta hoja se siguen mostrando (pudieron desactivarse
  // despues de armarla) para poder conservarlos o quitarlos.
  const plannedClientIds = new Set((isEdit ? (routeSheet?.visits ?? []) : []).map((visit) => visit.equipment?.client_id))
  const selectableClients = clients.filter((client) => isActiveClient(client) || plannedClientIds.has(client.id))

  const visibleClients = normalizedSearch
    ? selectableClients.filter(
        (client) =>
          client.name.toLowerCase().includes(normalizedSearch) ||
          equipment.some((item) => item.client_id === client.id && matchesSearch(item))
      )
    : selectableClients

  function toggleClient(clientId) {
    const clientEquipmentIds = equipment.filter((item) => item.client_id === clientId).map((item) => item.id)
    const removableIds = clientEquipmentIds.filter((id) => !lockedEquipmentIds.has(id))
    const isSelected = selectedClientIds.has(clientId)

    setSelectedClientIds((current) => {
      const next = new Set(current)
      if (isSelected) next.delete(clientId)
      else next.add(clientId)
      return next
    })

    setSelectedEquipmentIds((current) => {
      const next = new Set(current)
      if (isSelected) removableIds.forEach((id) => next.delete(id))
      else clientEquipmentIds.forEach((id) => next.add(id))
      return next
    })
  }

  function toggleEquipment(equipmentId) {
    if (lockedEquipmentIds.has(equipmentId)) return
    setSelectedEquipmentIds((current) => {
      const next = new Set(current)
      if (next.has(equipmentId)) next.delete(equipmentId)
      else next.add(equipmentId)
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (selectedEquipmentIds.size === 0) return
    setSaving(true)
    setErrorMessage('')
    try {
      const isPreventivo = form.serviceType === SERVICE_TYPE.PREVENTIVO
      const payload = {
        equipmentIds: Array.from(selectedEquipmentIds),
        serviceType: form.serviceType,
        scheduledDate: form.scheduledDate,
        descripcion: form.descripcion,
        visitOccurrence: isPreventivo ? form.visitOccurrence : null,
        createdBy,
      }
      if (isEdit) {
        await updateRouteSheetDetails(routeSheet.id, payload)
      } else {
        await createRouteSheetWithVisits(payload)
      }
      onSaved()
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo guardar la hoja de ruta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setErrorMessage('')
    try {
      await deleteRouteSheet(routeSheet.id)
      setConfirmingDelete(false)
      onDeleted()
    } catch (error) {
      setConfirmingDelete(false)
      setErrorMessage(error.message || 'No se pudo eliminar la hoja de ruta.')
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = isEdit && routeSheet && !hasLockedVisits(routeSheet)

  const actions = [{ label: 'Cancelar', variant: 'secondary-outline', onClick: onClose, disabled: saving }]
  if (isEdit) {
    actions.push({
      label: 'Eliminar',
      variant: 'destructive-outline',
      icon: 'delete',
      disabled: !canDelete || saving,
      onClick: () => setConfirmingDelete(true),
    })
  }
  actions.push({
    label: saving ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Hoja de Ruta',
    variant: 'primary',
    type: 'submit',
    form: 'route-sheet-form',
    disabled: saving,
  })

  return (
    <>
      <Modal
        open={open}
        title={isEdit ? 'Editar Hoja de Ruta' : 'Nueva Hoja de Ruta'}
        onClose={confirmingDelete || saving ? () => {} : onClose}
        size="lg"
        actions={actions}
      >
        <form id="route-sheet-form" onSubmit={handleSubmit} className="space-y-md">
          <Field
            label="Descripción"
            value={form.descripcion}
            onChange={(value) => setForm((f) => ({ ...f, descripcion: value }))}
            inputClassName={LARGE_INPUT}
          />

          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface block">Clientes y Equipos</label>
            {selectableClients.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No hay clientes activos para planificar.</p>
            ) : (
              <>
                <Field
                  label="Buscar por cliente, motor o generador"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  className="mb-sm"
                  inputClassName={LARGE_INPUT}
                />
                {visibleClients.length === 0 && (
                  <p className="font-body-md text-body-md text-on-surface-variant">No se encontraron clientes ni equipos para tu búsqueda.</p>
                )}
              </>
            )}
            {selectableClients.length > 0 && visibleClients.length > 0 && (
              <div className="border border-outline-variant rounded-lg max-h-[32rem] overflow-y-auto">
                {visibleClients.map((client) => {
                  const clientEquipment = equipment.filter((item) => item.client_id === client.id)
                  const clientNameMatches = !normalizedSearch || client.name.toLowerCase().includes(normalizedSearch)
                  const visibleEquipment = clientNameMatches ? clientEquipment : clientEquipment.filter(matchesSearch)
                  const isClientSelected = selectedClientIds.has(client.id)
                  const isExpanded = normalizedSearch ? true : isClientSelected
                  const selectedCount = clientEquipment.filter((item) => selectedEquipmentIds.has(item.id)).length

                  return (
                    <div key={client.id} className="border-b border-outline-variant last:border-b-0">
                      <label className="w-full flex items-center gap-sm py-sm px-sm hover:bg-surface-container-low transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isClientSelected}
                          onChange={() => toggleClient(client.id)}
                          className="w-[1.6rem] h-[1.6rem] rounded border-outline"
                        />
                        <span className="font-label-md text-[1.6rem] text-on-surface">{client.name}</span>
                        <span className="font-label-md text-label-md text-on-surface-variant">
                          ({selectedCount}/{clientEquipment.length})
                        </span>
                      </label>
                      {isExpanded && (
                        <div>
                          {visibleEquipment.length === 0 ? (
                            <p className="py-sm pl-xl pr-sm font-body-md text-body-md text-on-surface-variant border-t border-outline-variant/50">
                              {clientEquipment.length === 0
                                ? 'Este cliente todavía no tiene equipos cargados.'
                                : 'Ningún equipo de este cliente coincide con la búsqueda.'}
                            </p>
                          ) : (
                            visibleEquipment.map((item) => {
                              const isLocked = lockedEquipmentIds.has(item.id)
                              return (
                                <label
                                  key={item.id}
                                  className={`w-full flex items-center gap-sm py-sm pl-xl pr-sm transition-colors border-t border-outline-variant/50 ${
                                    isLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-container-low cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedEquipmentIds.has(item.id)}
                                    onChange={() => toggleEquipment(item.id)}
                                    disabled={isLocked}
                                    className="w-[1.6rem] h-[1.6rem] rounded border-outline"
                                  />
                                  <span className="font-body-md text-body-md text-on-surface">
                                    {item.motor} {item.generador}
                                  </span>
                                  {isLocked && (
                                    <span className="font-label-md text-label-md text-on-surface-variant">Ya tiene reporte</span>
                                  )}
                                </label>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selectedClientIds.size > 0 && (
            <p className="font-label-md text-label-md text-on-surface-variant">
              Total: {selectedEquipmentIds.size} equipo(s) seleccionado(s) en esta Hoja de Ruta.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block">Tipo de Servicio</label>
              <select
                value={form.serviceType}
                onChange={(event) =>
                  setForm((f) => ({ ...f, serviceType: event.target.value, visitOccurrence: '' }))
                }
                className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-lg text-body-lg text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
              >
                {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {form.serviceType === SERVICE_TYPE.PREVENTIVO && (
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block">Ocurrencia del Mes</label>
                <select
                  required
                  value={form.visitOccurrence}
                  onChange={(event) => setForm((f) => ({ ...f, visitOccurrence: event.target.value }))}
                  className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-lg text-body-lg text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
                >
                  <option value="" disabled>Seleccionar…</option>
                  {Object.entries(VISIT_OCCURRENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}
            <Field
              label="Fecha del Service"
              type="date"
              value={form.scheduledDate}
              onChange={(value) => setForm((f) => ({ ...f, scheduledDate: value }))}
              required
              inputClassName={LARGE_INPUT}
            />
          </div>

          {isEdit && !canDelete && (
            <p className="font-body-md text-body-md text-on-surface-variant">
              No se puede eliminar esta Hoja de Ruta ni destildar sus equipos con reporte enviado: se perdería ese historial.
            </p>
          )}

          {errorMessage && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {errorMessage}
            </p>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={confirmingDelete}
        title="Eliminar Hoja de Ruta"
        danger
        confirmLabel={deleting ? 'Eliminando…' : 'Eliminar'}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      >
        Esta acción no se puede deshacer. Se eliminará la hoja de ruta y sus {routeSheet?.visits?.length ?? 0} equipo(s) asociados.
      </ConfirmModal>
    </>
  )
}
