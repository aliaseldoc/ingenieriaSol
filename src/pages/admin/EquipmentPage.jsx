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
import { CONDITION_STATUS, CONDITION_STATUS_LABELS, FUEL_TYPE, FUEL_TYPE_LABELS } from '../../lib/constants'
import { formatDate } from '../../lib/dateUtils'
import { rowsToCsv, downloadCsv } from '../../lib/csv'

const REPORT_HEADERS = [
  'Cliente',
  'Motor',
  'Generador',
  'N° de Serie',
  'Condición',
  'Horas de Uso',
  '% de Combustible',
  'Último Service',
  'Cambio Filtro de Combustible',
  'Próx. Cambio Filtro de Combustible',
  'Cambio Filtro de Aceite',
  'Próx. Cambio Filtro de Aceite',
  'Cambio Filtro de Aire',
  'Próx. Cambio Filtro de Aire',
  'Cambio de Batería',
  'Próx. Cambio de Batería',
]

function equipmentToReportRow(item) {
  const dateOrEmpty = (value) => (value ? formatDate(value) : '')
  return [
    item.clients?.name ?? '',
    item.motor ?? '',
    item.generador ?? '',
    item.serial_number ?? '',
    CONDITION_STATUS_LABELS[item.condition_status] ?? '',
    item.hours_of_use ?? '',
    item.fuel_percentage != null ? `${item.fuel_percentage}%` : '',
    dateOrEmpty(item.last_service_date),
    dateOrEmpty(item.fuel_filter_changed_at),
    dateOrEmpty(item.fuel_filter_next_due_at),
    dateOrEmpty(item.oil_filter_changed_at),
    dateOrEmpty(item.oil_filter_next_due_at),
    dateOrEmpty(item.air_filter_changed_at),
    dateOrEmpty(item.air_filter_next_due_at),
    dateOrEmpty(item.battery_changed_at),
    dateOrEmpty(item.battery_next_due_at),
  ]
}

const EMPTY_EQUIPMENT_FORM = {
  client_id: '',
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

  const allClientsCollapsed =
    clientGroups.length > 0 && clientGroups.every((group) => collapsedClientIds.has(group.client.id))

  function toggleClientExpanded(clientId) {
    setCollapsedClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  function toggleAllClientsCollapsed() {
    setCollapsedClientIds(
      allClientsCollapsed ? new Set() : new Set(clientGroups.map((group) => group.client.id))
    )
  }

  async function handleCreateEquipment(event) {
    event.preventDefault()
    setSavingEquipment(true)
    setEquipmentError('')
    try {
      await createEquipment({
        ...equipmentForm,
        power_kva: equipmentForm.power_kva ? Number(equipmentForm.power_kva) : null,
        fuel_capacity: equipmentForm.fuel_capacity ? Number(equipmentForm.fuel_capacity) : null,
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

  function handleDownloadReport() {
    const sorted = [...equipment].sort((a, b) => {
      const clientCompare = (a.clients?.name ?? '').localeCompare(b.clients?.name ?? '')
      return clientCompare !== 0 ? clientCompare : (a.motor ?? '').localeCompare(b.motor ?? '')
    })
    const csv = rowsToCsv(REPORT_HEADERS, sorted.map(equipmentToReportRow))
    downloadCsv(`reporte-equipos-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  if (loading || clientsLoading) return <Spinner label="Cargando inventario…" />

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-sm mb-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Inventario de Equipos</h1>
        </div>
        <div className="flex gap-sm">
          <Button variant="secondary-outline" icon="download" onClick={handleDownloadReport}>
            Descargar Reporte
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

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <div className="flex md:grid md:grid-cols-12 gap-sm px-sm py-xs bg-surface-container border-b border-outline-variant">
          <div className="md:col-span-4 flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant uppercase">
            {clientGroups.length > 0 && (
              <button
                type="button"
                onClick={toggleAllClientsCollapsed}
                aria-label={allClientsCollapsed ? 'Expandir todos los clientes' : 'Contraer todos los clientes'}
                className="text-on-surface-variant hover:text-secondary transition-colors"
              >
                <span className="material-symbols-outlined text-[1.8rem] block">
                  {allClientsCollapsed ? 'unfold_more' : 'unfold_less'}
                </span>
              </button>
            )}
            <span>Cliente / Equipo</span>
          </div>
          {/* Por debajo de md, EquipmentRow.jsx pasa a mini-card apilada con
              sus propias etiquetas — estas 4 columnas dejan de aplicar. */}
          <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">% Combustible</span>
          <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Horas de Uso</span>
          <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Último Service</span>
          <span className="hidden md:block md:col-span-2 font-label-sm text-label-sm text-on-surface-variant uppercase">Condición</span>
        </div>
        {clientGroups.length === 0 ? (
          <p className="p-md font-body-sm text-body-sm text-on-surface-variant">
            {searchTerm.trim() ? 'No se encontraron equipos para tu búsqueda.' : 'Todavía no hay clientes ni equipos cargados.'}
          </p>
        ) : (
          clientGroups.map((group) => (
            <ClientGroupRow
              key={group.client.id}
              client={group.client}
              equipmentList={group.equipmentList}
              expanded={!collapsedClientIds.has(group.client.id)}
              onToggleExpanded={() => toggleClientExpanded(group.client.id)}
              onOpenHistory={setHistoryEquipment}
            />
          ))
        )}
      </div>

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
              <Field label="Tamaño de Tanque (Litros)" type="number" value={equipmentForm.fuel_capacity} onChange={(v) => setEquipmentForm((f) => ({ ...f, fuel_capacity: v }))} />
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
