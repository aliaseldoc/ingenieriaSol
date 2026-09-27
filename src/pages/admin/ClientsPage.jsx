import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useClients } from '../../hooks/useClients'
import { isActiveClient } from '../../lib/constants'
import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import Spinner from '../../components/ui/Spinner'
import ClientCard from '../../features/clients/ClientCard'
import ClientDetailModal from '../../features/clients/ClientDetailModal'
import ClientFormModal from '../../features/clients/ClientFormModal'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'

function ClientSection({ title, clientGroups, emptyMessage, onOpenDetail }) {
  return (
    <section className="space-y-sm">
      <h2 className="font-headline-md text-headline-md text-on-surface">
        {title} ({clientGroups.length})
      </h2>
      {clientGroups.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">{emptyMessage}</p>
      ) : (
        clientGroups.map(({ client, equipmentList }) => (
          <ClientCard key={client.id} client={client} equipmentCount={equipmentList.length} onOpenDetail={onOpenDetail} />
        ))
      )}
    </section>
  )
}

export default function ClientsPage() {
  const { profile } = useAuth()
  const { equipment, loading: equipmentLoading, reload: reloadEquipment } = useEquipment()
  const { clients, loading: clientsLoading, reload: reloadClients } = useClients()
  const [searchTerm, setSearchTerm] = useState('')
  const [historyEquipment, setHistoryEquipment] = useState(null)
  const [detailClient, setDetailClient] = useState(null)
  const [formModal, setFormModal] = useState(null) // { mode: 'create' | 'edit', client? }

  const clientGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return clients
      .map((client) => ({
        client,
        equipmentList: equipment.filter((item) => item.client_id === client.id),
      }))
      .filter(({ client, equipmentList }) => {
        if (!term) return true
        const haystack = [client.name, ...equipmentList.map((item) => item.motor)].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(term)
      })
      .sort((a, b) => a.client.name.localeCompare(b.client.name))
  }, [clients, equipment, searchTerm])

  if (equipmentLoading || clientsLoading) return <Spinner label="Cargando clientes…" />

  const activeGroups = clientGroups.filter(({ client }) => isActiveClient(client))
  const inactiveGroups = clientGroups.filter(({ client }) => !isActiveClient(client))
  const isSearching = searchTerm.trim() !== ''
  // Se deriva del listado completo (no del filtrado por la busqueda) para que
  // el detalle se actualice solo al editar o eliminar un equipo.
  const detailEquipment = detailClient ? equipment.filter((item) => item.client_id === detailClient.id) : []

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-sm mb-xs">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Clientes</h1>
        <Button variant="primary" icon="person_add" onClick={() => setFormModal({ mode: 'create' })}>
          Nuevo Cliente
        </Button>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Ficha y equipos instalados por cliente.</p>

      <Field label="Buscar por cliente o motor" value={searchTerm} onChange={setSearchTerm} className="max-w-[36rem] mb-md" />

      {clientGroups.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {isSearching ? 'No se encontraron clientes para tu búsqueda.' : 'Todavía no hay clientes cargados.'}
        </p>
      ) : (
        <div className="space-y-xl">
          <ClientSection
            title="Clientes Activos"
            clientGroups={activeGroups}
            emptyMessage={isSearching ? 'Ningún cliente activo coincide con la búsqueda.' : 'No hay clientes activos.'}
            onOpenDetail={setDetailClient}
          />
          <ClientSection
            title="Clientes Inactivos"
            clientGroups={inactiveGroups}
            emptyMessage={isSearching ? 'Ningún cliente inactivo coincide con la búsqueda.' : 'No hay clientes inactivos.'}
            onOpenDetail={setDetailClient}
          />
        </div>
      )}

      {/* Va antes que la ficha del equipo: los modales se apilan en el orden
          del DOM, y la ficha se abre desde este detalle, encima de el. */}
      <ClientDetailModal
        client={detailClient}
        equipmentList={detailEquipment}
        onClose={() => setDetailClient(null)}
        onEdit={(client) => {
          setDetailClient(null)
          setFormModal({ mode: 'edit', client })
        }}
        onDeleted={() => {
          setDetailClient(null)
          reloadClients()
        }}
        onUpdated={(updated) => {
          setDetailClient(updated)
          reloadClients()
        }}
        onOpenEquipment={setHistoryEquipment}
      />

      <EquipmentHistoryPanel
        equipment={historyEquipment}
        onClose={() => setHistoryEquipment(null)}
        onUpdated={(updated) => {
          setHistoryEquipment(updated)
          reloadEquipment()
        }}
        onDeleted={reloadEquipment}
      />

      <ClientFormModal
        open={Boolean(formModal)}
        mode={formModal?.mode}
        client={formModal?.client}
        createdBy={profile.id}
        onClose={() => setFormModal(null)}
        onSaved={() => {
          setFormModal(null)
          reloadClients()
        }}
      />
    </div>
  )
}
