import { useState } from 'react'
import { deleteClient, updateClient } from '../../api/clients'
import { isActiveClient } from '../../lib/constants'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Switch from '../../components/ui/Switch'
import EquipmentRow from '../equipmentInventory/EquipmentRow'

function DetailField({ label, value }) {
  return (
    <div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
      <p className="font-body-md text-body-md text-on-surface">{value || '—'}</p>
    </div>
  )
}

// Solo administrativo y supervisor llegan a la vista Clientes, y los dos
// pueden hacer lo mismo con el cliente: cambiar su estado, modificarlo o
// eliminarlo.
export default function ClientDetailModal({ client, equipmentList, onClose, onEdit, onDeleted, onUpdated, onOpenEquipment }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [savingActive, setSavingActive] = useState(false)
  const [activeError, setActiveError] = useState('')

  function handleClose() {
    setErrorMessage('')
    setActiveError('')
    onClose()
  }

  // El switch guarda en el momento, sin pasar por "Modificar".
  async function handleChangeActive(active) {
    setSavingActive(true)
    setActiveError('')
    try {
      onUpdated(await updateClient(client.id, { active }))
    } catch (error) {
      setActiveError(error.message || 'No se pudo cambiar el estado del cliente.')
    } finally {
      setSavingActive(false)
    }
  }

  async function handleDelete() {
    setErrorMessage('')
    try {
      await deleteClient(client.id)
      setConfirmingDelete(false)
      onDeleted()
    } catch (error) {
      setErrorMessage(
        error.message?.includes('foreign key')
          ? 'No se puede eliminar: el cliente todavía tiene equipos asociados.'
          : error.message || 'No se pudo eliminar el cliente.'
      )
    }
  }

  const actions = [
    { label: 'Cerrar', variant: 'secondary-outline', onClick: handleClose },
    { label: 'Eliminar', variant: 'destructive-outline', icon: 'delete', onClick: () => setConfirmingDelete(true) },
    { label: 'Modificar', variant: 'primary', icon: 'edit', onClick: () => onEdit(client) },
  ]

  return (
    <>
      <Modal open={Boolean(client)} title="Detalle del Cliente" onClose={handleClose} size="lg" actions={actions}>
        {client && (
          <div className="space-y-md">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-xs">Estado</p>
              <Switch
                id="client-active"
                checked={isActiveClient(client)}
                disabled={savingActive}
                onChange={handleChangeActive}
                label={isActiveClient(client) ? 'Activo' : 'Inactivo'}
              />
              {activeError && (
                <p role="alert" className="font-body-sm text-body-sm text-error mt-xs">
                  {activeError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              <DetailField label="CUIT" value={client.tax_id} />
              <DetailField label="Contacto" value={client.contact_name} />
              <DetailField label="Teléfono" value={client.contact_phone} />
              <DetailField label="Email" value={client.contact_email} />
              <DetailField label="Dirección" value={client.address} />
              <DetailField label="Ciudad" value={client.city} />
              {client.notes && (
                <div className="col-span-2 md:col-span-4">
                  <DetailField label="Notas" value={client.notes} />
                </div>
              )}
            </div>

            <section>
              <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wider mb-md px-md py-sm rounded">
                Equipos ({equipmentList.length})
              </h3>
              {equipmentList.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">Este cliente todavía no tiene equipos cargados.</p>
              ) : (
                <div className="border border-outline-variant rounded overflow-hidden">
                  {/* Mismas columnas que EquipmentRow en md+; por debajo cada
                      fila pasa a mini-card con sus propias etiquetas. */}
                  <div className="hidden md:grid md:grid-cols-12 gap-sm pl-xl pr-sm py-xs bg-surface-container font-label-sm text-label-sm text-on-surface-variant uppercase">
                    <span className="col-span-4">Equipo</span>
                    <span className="col-span-2">Combustible</span>
                    <span className="col-span-2">Horas de Uso</span>
                    <span className="col-span-2">Último Service</span>
                    <span className="col-span-2">Condición</span>
                  </div>
                  {equipmentList.map((equipment, index) => (
                    <EquipmentRow key={equipment.id} equipment={equipment} onOpenHistory={onOpenEquipment} index={index} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmingDelete}
        title={`Eliminar ${client?.name ?? ''}`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => {
          setConfirmingDelete(false)
          setErrorMessage('')
        }}
        onConfirm={handleDelete}
      >
        ¿Seguro que querés eliminar este cliente? Esta acción no se puede deshacer.
        {errorMessage && <span role="alert" className="block text-error mt-sm">{errorMessage}</span>}
      </ConfirmModal>
    </>
  )
}
