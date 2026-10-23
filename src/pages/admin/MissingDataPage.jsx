import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useClients } from '../../hooks/useClients'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import StatusChip from '../../components/ui/StatusChip'
import ClientFormModal from '../../features/clients/ClientFormModal'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'
import RequestDataModal from '../../features/missingData/RequestDataModal'
import { buildMissingDataReport, requestableFieldsFor } from '../../features/missingData/missingData'

function fieldList(fields) {
  return fields.map((field) => field.label).join(', ')
}

function EquipmentMissing({ group, missingClientFields, onComplete, onRequest }) {
  const { item, sections, requestedKeys } = group
  const requestable = requestableFieldsFor(group, missingClientFields)
  return (
    <li className="border border-outline-variant rounded-lg p-md space-y-sm">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-on-surface">{item.motor || 'Sin motor'}</p>
          {item.internal_code && <p className="font-body-sm text-body-sm text-on-surface-variant">{item.internal_code}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          {requestedKeys.length > 0 && (
            <StatusChip label={`Pedido al técnico: ${requestedKeys.length} ${requestedKeys.length === 1 ? 'dato' : 'datos'}`} tone="warning" variant="tag" />
          )}
          {requestable.length > 0 && (
            <Button variant="secondary-outline" icon="assignment_ind" onClick={() => onRequest(group, requestable)}>
              Pedir al técnico
            </Button>
          )}
          <Button variant="primary" icon="edit" onClick={() => onComplete(item)}>
            Completar equipo
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-[18rem_minmax(0,1fr)] gap-x-md gap-y-xs font-body-md text-body-md">
        {sections.map((section) => [
          <dt key={`${section.title}-titulo`} className="text-on-surface-variant">{section.title}</dt>,
          <dd key={`${section.title}-datos`} className="text-on-surface">{fieldList(section.fields)}</dd>,
        ])}
      </dl>
    </li>
  )
}

// Lo que falta cargar de cada cliente activo y de sus equipos, para
// completarlo desde aca con los mismos formularios de siempre o pedirle al
// tecnico que lo releve en la proxima visita. La usan administrativo y
// supervisor.
export default function MissingDataPage() {
  const { profile } = useAuth()
  const { equipment, loading: equipmentLoading, error: equipmentError, reload: reloadEquipment } = useEquipment()
  const { clients, loading: clientsLoading, error: clientsError, reload: reloadClients } = useClients()
  const [clientToEdit, setClientToEdit] = useState(null)
  const [equipmentToEdit, setEquipmentToEdit] = useState(null)
  // null, o { equipment, candidates } para el cuadro "Pedir al tecnico".
  const [request, setRequest] = useState(null)

  const report = useMemo(() => buildMissingDataReport(clients, equipment), [clients, equipment])

  // Solo la primera carga: al recargar despues de guardar la lista sigue a la
  // vista, y la ficha abierta no se desmonta (volveria a abrirse en edicion).
  if ((equipmentLoading && equipment.length === 0) || (clientsLoading && clients.length === 0)) {
    return <Spinner label="Revisando datos…" />
  }

  const loadError = equipmentError || clientsError

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Datos Incompletos</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        {report.clientCount === 0
          ? 'Clientes activos y sus equipos.'
          : `${report.clientCount} ${report.clientCount === 1 ? 'cliente' : 'clientes'} con datos por completar · ${report.equipmentCount} ${report.equipmentCount === 1 ? 'equipo' : 'equipos'}`}
      </p>

      {loadError && (
        <p role="alert" className="font-body-md text-body-md text-error mb-md">
          No se pudieron cargar los datos: {loadError.message ?? 'error desconocido'}.
        </p>
      )}

      {!loadError && report.clientCount === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
          <EmptyState icon="task_alt" title="No hay datos por completar" description="Todos los clientes activos y sus equipos tienen la ficha completa." />
        </div>
      ) : (
        <div className="space-y-md">
          {report.clients.map(({ client, missingClientFields, equipment: equipmentGroups }) => (
            <article key={client.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
              <div className="list-title-bar px-md py-sm">
                <h2 className="font-label-md text-label-md uppercase">{client.name}</h2>
              </div>
              <div className="p-md space-y-md">
                {missingClientFields.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-sm">
                    <p className="font-body-md text-body-md text-on-surface min-w-0">
                      <span className="text-on-surface-variant">Datos del cliente · Falta: </span>
                      {fieldList(missingClientFields)}
                    </p>
                    <Button variant="secondary-outline" icon="edit" onClick={() => setClientToEdit(client)}>
                      Completar cliente
                    </Button>
                  </div>
                )}
                {equipmentGroups.length > 0 && (
                  <ul className="space-y-sm">
                    {equipmentGroups.map((group) => (
                      <EquipmentMissing
                        key={group.item.id}
                        group={group}
                        missingClientFields={missingClientFields}
                        onComplete={setEquipmentToEdit}
                        onRequest={(selectedGroup, candidates) => setRequest({ equipment: selectedGroup.item, candidates })}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <EquipmentHistoryPanel
        equipment={equipmentToEdit}
        openInEditMode
        onClose={() => setEquipmentToEdit(null)}
        onUpdated={(updated) => {
          setEquipmentToEdit(updated)
          reloadEquipment()
        }}
        onDeleted={reloadEquipment}
      />

      <ClientFormModal
        open={Boolean(clientToEdit)}
        mode="edit"
        client={clientToEdit}
        createdBy={profile.id}
        onClose={() => setClientToEdit(null)}
        onSaved={() => {
          setClientToEdit(null)
          reloadClients()
        }}
      />

      {request && (
        <RequestDataModal
          key={request.equipment.id}
          equipment={request.equipment}
          candidates={request.candidates}
          onClose={() => setRequest(null)}
          onSaved={async () => {
            setRequest(null)
            await reloadEquipment()
          }}
        />
      )}
    </div>
  )
}
