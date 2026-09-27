import { useMemo, useState } from 'react'
import { useClients } from '../../hooks/useClients'
import { useEquipment } from '../../hooks/useEquipment'
import { isActiveClient } from '../../lib/constants'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'

const SELECT_CLASSES =
  'w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all'

// Paso previo al formulario de visita cuando el tecnico genera un reporte por
// su cuenta: elegir cliente y, dentro de ese cliente, el grupo electrogeno.
// El formulario que viene despues es exactamente el de una visita planificada.
export default function NewReportModal({ open, onClose, onConfirm }) {
  const { clients, loading: clientsLoading } = useClients()
  const { equipment, loading: equipmentLoading } = useEquipment()

  const [clientId, setClientId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // A un cliente inactivo ya no se le da servicio: no se ofrece para reportar.
  const activeClients = useMemo(() => clients.filter(isActiveClient), [clients])
  const equipmentOfClient = useMemo(
    () => equipment.filter((item) => item.client_id === clientId),
    [equipment, clientId]
  )

  function handleChangeClient(nextClientId) {
    setClientId(nextClientId)
    // El equipo elegido pertenece al cliente anterior: se descarta para no
    // terminar creando el reporte sobre un equipo de otra empresa.
    setEquipmentId('')
  }

  function handleClose() {
    if (creating) return
    setClientId('')
    setEquipmentId('')
    setError('')
    onClose()
  }

  async function handleConfirm() {
    setCreating(true)
    setError('')
    try {
      await onConfirm(equipmentId)
    } catch (confirmError) {
      setError(confirmError.message || 'No se pudo generar el reporte.')
      setCreating(false)
    }
  }

  const loading = clientsLoading || equipmentLoading

  return (
    <Modal
      open={open}
      title="Nuevo Reporte de Visita"
      onClose={handleClose}
      actions={[
        { label: 'Cancelar', variant: 'secondary-outline', onClick: handleClose, disabled: creating },
        {
          label: creating ? 'Generando…' : 'Generar Reporte',
          variant: 'primary',
          onClick: handleConfirm,
          disabled: !equipmentId || creating,
        },
      ]}
    >
      {loading ? (
        <Spinner label="Cargando clientes y equipos…" />
      ) : (
        <div className="space-y-md">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Elegí el cliente y el grupo electrógeno que visitaste. Después completás el mismo formulario de siempre.
          </p>

          <div className="space-y-xs">
            <label htmlFor="reporte-cliente" className="font-label-sm text-label-sm text-on-surface block">
              Cliente
            </label>
            <select
              id="reporte-cliente"
              value={clientId}
              onChange={(event) => handleChangeClient(event.target.value)}
              className={SELECT_CLASSES}
            >
              <option value="" disabled>
                Seleccionar cliente
              </option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-xs">
            <label htmlFor="reporte-equipo" className="font-label-sm text-label-sm text-on-surface block">
              Grupo Electrógeno
            </label>
            <select
              id="reporte-equipo"
              value={equipmentId}
              disabled={!clientId}
              onChange={(event) => setEquipmentId(event.target.value)}
              className={`${SELECT_CLASSES} ${!clientId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="" disabled>
                {clientId ? 'Seleccionar equipo' : 'Elegí primero un cliente'}
              </option>
              {equipmentOfClient.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.motor} {item.generador}
                </option>
              ))}
            </select>
            {clientId && equipmentOfClient.length === 0 && (
              <p className="font-body-sm text-body-sm text-warning">Este cliente todavía no tiene equipos cargados.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
