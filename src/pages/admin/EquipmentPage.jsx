import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useClients } from '../../hooks/useClients'
import { createEquipment } from '../../api/equipment'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import FormSection from '../../components/ui/FormSection'
import Field from '../../components/ui/Field'
import Spinner from '../../components/ui/Spinner'
import ClientGroupRow from '../../features/equipmentInventory/ClientGroupRow'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'
import { CONDITION_STATUS, CONDITION_STATUS_LABELS, FUEL_TYPE, FUEL_TYPE_LABELS, isActiveClient, isGasEquipment } from '../../lib/constants'
import { buildEquipmentReportSheets, equipmentReportFileName } from '../../features/equipmentInventory/equipmentReportXlsx'
import {
  buildOverdueServiceRows,
  buildOverdueServicesSheets,
  overdueServicesFileName,
} from '../../features/equipmentInventory/overdueServicesXlsx'

const EMPTY_EQUIPMENT_FORM = {
  client_id: '',
  service_start_date: '',
  service_end_date: '',
  purchase_order: '',
  monthly_visits: '',
  motor: '',
  generador: '',
  serial_number: '',
  power_kva: '',
  fuel_type: FUEL_TYPE.DIESEL,
  fuel_filter_spec: '',
  oil_filter_spec: '',
  air_filter_spec: '',
  coolant_capacity: '',
  fuel_capacity: '',
  oil_capacity: '',
  battery_quantity: '',
  battery_size: '',
  condition_status: CONDITION_STATUS.OPTIMO,
}

// Una seccion por estado del cliente, igual que en Clientes: cada una con su
// tabla y su boton de contraer/expandir todo, que solo actua sobre ella.
function ClientEquipmentSection({ title, clientGroups, emptyMessage, collapsedClientIds, onToggleClient, onSetCollapsed, onOpenHistory }) {
  const allCollapsed = clientGroups.length > 0 && clientGroups.every((group) => collapsedClientIds.has(group.client.id))

  return (
    <section className="space-y-sm">
      <h2 className="font-headline-md text-headline-md text-on-surface">
        {title} ({clientGroups.length})
      </h2>
      {clientGroups.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">{emptyMessage}</p>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="flex md:grid md:grid-cols-12 gap-sm px-sm py-xs bg-surface-container border-b border-outline-variant">
            <div className="md:col-span-4 flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant uppercase">
              <button
                type="button"
                onClick={() => onSetCollapsed(clientGroups, !allCollapsed)}
                aria-label={allCollapsed ? 'Expandir todos los clientes' : 'Contraer todos los clientes'}
                className="text-on-surface-variant hover:text-secondary transition-colors"
              >
                <span className="material-symbols-outlined text-[1.8rem] block">
                  {allCollapsed ? 'unfold_more' : 'unfold_less'}
                </span>
              </button>
              <span>Cliente / Equipo</span>
            </div>
            {/* Por debajo de md, EquipmentRow.jsx pasa a mini-card apilada con
                sus propias etiquetas — estas 4 columnas dejan de aplicar. */}
            <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Combustible</span>
            <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Horas de Uso</span>
            <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Último Service</span>
            <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Condición</span>
          </div>
          {clientGroups.map((group) => (
            <ClientGroupRow
              key={group.client.id}
              client={group.client}
              equipmentList={group.equipmentList}
              expanded={!collapsedClientIds.has(group.client.id)}
              onToggleExpanded={() => onToggleClient(group.client.id)}
              onOpenHistory={onOpenHistory}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default function EquipmentPage() {
  const { profile } = useAuth()
  const { equipment, loading, reload: reloadEquipment } = useEquipment()
  const { clients, loading: clientsLoading } = useClients()

  const [historyEquipment, setHistoryEquipment] = useState(null)
  const [showNewEquipment, setShowNewEquipment] = useState(false)
  const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT_FORM)
  const [savingEquipment, setSavingEquipment] = useState(false)
  const [equipmentError, setEquipmentError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  // El Excel que se esta generando: 'reporte' | 'vencidos' | null.
  const [downloading, setDownloading] = useState(null)
  const [downloadError, setDownloadError] = useState('')
  const [collapsedClientIds, setCollapsedClientIds] = useState(() => new Set())

  const filteredEquipment = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return equipment
    return equipment.filter((item) => {
      const haystack = [item.motor, item.generador, item.clients?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [equipment, searchTerm])

  const clientGroups = useMemo(() => {
    const groups = new Map()
    for (const item of filteredEquipment) {
      const client = item.clients
      if (!client) continue
      if (!groups.has(client.id)) groups.set(client.id, { client, equipmentList: [] })
      groups.get(client.id).equipmentList.push(item)
    }
    return Array.from(groups.values()).sort((a, b) => a.client.name.localeCompare(b.client.name))
  }, [filteredEquipment])

  const activeGroups = clientGroups.filter(({ client }) => isActiveClient(client))
  const inactiveGroups = clientGroups.filter(({ client }) => !isActiveClient(client))
  const isSearching = Boolean(searchTerm.trim())

  function toggleClientExpanded(clientId) {
    setCollapsedClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  function setGroupsCollapsed(groups, collapsed) {
    setCollapsedClientIds((prev) => {
      const next = new Set(prev)
      for (const group of groups) {
        if (collapsed) next.add(group.client.id)
        else next.delete(group.client.id)
      }
      return next
    })
  }

  async function handleCreateEquipment(event) {
    event.preventDefault()
    setSavingEquipment(true)
    setEquipmentError('')
    try {
      await createEquipment({
        ...equipmentForm,
        service_start_date: equipmentForm.service_start_date || null,
        service_end_date: equipmentForm.service_end_date || null,
        monthly_visits: equipmentForm.monthly_visits ? Number(equipmentForm.monthly_visits) : null,
        power_kva: equipmentForm.power_kva ? Number(equipmentForm.power_kva) : null,
        // A gas el campo no se muestra: no se guarda lo que haya quedado escrito.
        fuel_capacity: equipmentForm.fuel_capacity && !isGasEquipment(equipmentForm) ? Number(equipmentForm.fuel_capacity) : null,
        created_by: profile.id,
      })
      setEquipmentForm(EMPTY_EQUIPMENT_FORM)
      setShowNewEquipment(false)
      reloadEquipment()
    } catch (error) {
      setEquipmentError(error.message || 'No se pudo guardar el equipo.')
    } finally {
      setSavingEquipment(false)
    }
  }

  function closeNewEquipment() {
    setShowNewEquipment(false)
    setEquipmentForm(EMPTY_EQUIPMENT_FORM)
    setEquipmentError('')
  }

  // Los Excel salen de todo el inventario (sin el filtro del buscador). La
  // libreria se carga recien aca: no hace falta en el resto de la app.
  async function downloadXlsx(kind, buildSheets, fileName) {
    setDownloading(kind)
    setDownloadError('')
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser')
      await writeXlsxFile(buildSheets()).toFile(fileName)
    } catch (error) {
      setDownloadError(error?.message || 'No se pudo generar el reporte.')
    } finally {
      setDownloading(null)
    }
  }

  function handleDownloadReport() {
    downloadXlsx('reporte', () => buildEquipmentReportSheets(equipment), equipmentReportFileName())
  }

  // Services de aceite y baterias vencidos o por vencer, por cliente.
  function handleDownloadOverdue() {
    downloadXlsx(
      'vencidos',
      () => buildOverdueServicesSheets(buildOverdueServiceRows(equipment, clients)),
      overdueServicesFileName(),
    )
  }

  if (loading || clientsLoading) return <Spinner label="Cargando inventario…" />

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-sm mb-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Inventario de Equipos</h1>
          {downloadError && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {downloadError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-sm">
          <Button variant="secondary-outline" icon="download" onClick={handleDownloadReport} disabled={downloading !== null}>
            {downloading === 'reporte' ? 'Generando…' : 'Descargar Reporte'}
          </Button>
          <Button variant="secondary-outline" icon="event_busy" onClick={handleDownloadOverdue} disabled={downloading !== null}>
            {downloading === 'vencidos' ? 'Generando…' : 'Descargar Vencidos'}
          </Button>
          <Button variant="primary" icon="add" onClick={() => setShowNewEquipment(true)}>
            Nuevo Equipo
          </Button>
        </div>
      </div>

      <Field
        label="Buscar por motor, generador o cliente"
        value={searchTerm}
        onChange={setSearchTerm}
        className="max-w-[36rem] mb-md"
      />

      {clientGroups.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {isSearching ? 'No se encontraron equipos para tu búsqueda.' : 'Todavía no hay clientes ni equipos cargados.'}
        </p>
      ) : (
        <div className="space-y-xl">
          <ClientEquipmentSection
            title="Clientes Activos"
            clientGroups={activeGroups}
            emptyMessage={isSearching ? 'Ningún equipo de un cliente activo coincide con la búsqueda.' : 'No hay equipos de clientes activos.'}
            collapsedClientIds={collapsedClientIds}
            onToggleClient={toggleClientExpanded}
            onSetCollapsed={setGroupsCollapsed}
            onOpenHistory={setHistoryEquipment}
          />
          <ClientEquipmentSection
            title="Clientes Inactivos"
            clientGroups={inactiveGroups}
            emptyMessage={isSearching ? 'Ningún equipo de un cliente inactivo coincide con la búsqueda.' : 'No hay equipos de clientes inactivos.'}
            collapsedClientIds={collapsedClientIds}
            onToggleClient={toggleClientExpanded}
            onSetCollapsed={setGroupsCollapsed}
            onOpenHistory={setHistoryEquipment}
          />
        </div>
      )}

      <EquipmentHistoryPanel
        equipment={historyEquipment}
        onClose={() => setHistoryEquipment(null)}
        onUpdated={(updated) => {
          setHistoryEquipment(updated)
          reloadEquipment()
        }}
        onDeleted={reloadEquipment}
      />

      <Modal
        open={showNewEquipment}
        title="Nuevo Equipo"
        onClose={savingEquipment ? () => {} : closeNewEquipment}
        size="lg"
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: closeNewEquipment, disabled: savingEquipment },
          { label: savingEquipment ? 'Guardando…' : 'Guardar Equipo', variant: 'primary', type: 'submit', form: 'new-equipment-form', disabled: savingEquipment },
        ]}
      >
        <form id="new-equipment-form" onSubmit={handleCreateEquipment} className="space-y-md">
          <div className="space-y-xs">
            <label className="font-label-sm text-label-sm text-on-surface block">Cliente</label>
            <select
              required
              value={equipmentForm.client_id}
              onChange={(event) => setEquipmentForm((f) => ({ ...f, client_id: event.target.value }))}
              className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
            >
              <option value="" disabled>Seleccionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <FormSection title="Datos Administrativos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Inicio del Servicio" type="date" value={equipmentForm.service_start_date} onChange={(v) => setEquipmentForm((f) => ({ ...f, service_start_date: v }))} />
              <Field label="Fin del Servicio" type="date" value={equipmentForm.service_end_date} onChange={(v) => setEquipmentForm((f) => ({ ...f, service_end_date: v }))} />
              <Field label="Orden de Compra" value={equipmentForm.purchase_order} onChange={(v) => setEquipmentForm((f) => ({ ...f, purchase_order: v }))} />
              <Field label="Cantidad de Visitas Mensuales" type="number" min="1" max="31" step="1" value={equipmentForm.monthly_visits} onChange={(v) => setEquipmentForm((f) => ({ ...f, monthly_visits: v }))} />
            </div>
          </FormSection>

          <FormSection title="Datos Principales">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Motor" value={equipmentForm.motor} onChange={(v) => setEquipmentForm((f) => ({ ...f, motor: v }))} />
              <Field label="N° de Serie" value={equipmentForm.serial_number} onChange={(v) => setEquipmentForm((f) => ({ ...f, serial_number: v }))} />
              <Field label="Generador" value={equipmentForm.generador} onChange={(v) => setEquipmentForm((f) => ({ ...f, generador: v }))} />
              <Field label="Potencia (kVA)" type="number" value={equipmentForm.power_kva} onChange={(v) => setEquipmentForm((f) => ({ ...f, power_kva: v }))} />
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-on-surface block">Combustible</label>
                <select
                  value={equipmentForm.fuel_type}
                  onChange={(event) => setEquipmentForm((f) => ({ ...f, fuel_type: event.target.value }))}
                  className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
                >
                  {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-on-surface block">Condición</label>
                <select
                  value={equipmentForm.condition_status}
                  onChange={(event) => setEquipmentForm((f) => ({ ...f, condition_status: event.target.value }))}
                  className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
                >
                  {Object.entries(CONDITION_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Datos Secundarios">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Filtro de Combustible" value={equipmentForm.fuel_filter_spec} onChange={(v) => setEquipmentForm((f) => ({ ...f, fuel_filter_spec: v }))} />
              <Field label="Filtro de Aceite" value={equipmentForm.oil_filter_spec} onChange={(v) => setEquipmentForm((f) => ({ ...f, oil_filter_spec: v }))} />
              <Field label="Filtro de Aire" value={equipmentForm.air_filter_spec} onChange={(v) => setEquipmentForm((f) => ({ ...f, air_filter_spec: v }))} />
              <Field label="Cantidad de Agua" value={equipmentForm.coolant_capacity} onChange={(v) => setEquipmentForm((f) => ({ ...f, coolant_capacity: v }))} />
              {!isGasEquipment(equipmentForm) && (
                <Field label="Tamaño de Tanque (Litros)" type="number" value={equipmentForm.fuel_capacity} onChange={(v) => setEquipmentForm((f) => ({ ...f, fuel_capacity: v }))} />
              )}
              <Field label="Cantidad de Aceite" value={equipmentForm.oil_capacity} onChange={(v) => setEquipmentForm((f) => ({ ...f, oil_capacity: v }))} />
              <Field label="Cantidad de Baterías" value={equipmentForm.battery_quantity} onChange={(v) => setEquipmentForm((f) => ({ ...f, battery_quantity: v }))} />
              <Field label="Medida de Batería" value={equipmentForm.battery_size} onChange={(v) => setEquipmentForm((f) => ({ ...f, battery_size: v }))} />
            </div>
          </FormSection>
          {equipmentError && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {equipmentError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
