// Datos incompletos de clientes y equipos, y el pedido de datos al tecnico
// (ver 0032_pedido_datos.sql). Puro: sin React ni Supabase.
import { FUEL_TYPE, FUEL_TYPE_LABELS, isActiveClient, isGasEquipment } from '../../lib/constants.js'

export const FIELD_TARGET = {
  CLIENTE: 'cliente',
  EQUIPO: 'equipo',
}

export const FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  EMAIL: 'email',
  FUEL: 'fuel',
}

export const EQUIPMENT_SECTION = {
  ADMINISTRATIVOS: 'Datos Administrativos',
  PRINCIPALES: 'Datos Principales',
  SECUNDARIOS: 'Datos Secundarios',
}

// Los campos que se revisan, con las etiquetas de los formularios de cliente y
// de la ficha del equipo. requestable: se le puede pedir al tecnico que lo
// releve en la visita (tiene que coincidir con el check de la 0032).
// appliesTo: si esta, el campo solo cuenta para los registros que cumplen.
export const MISSING_DATA_FIELDS = [
  { key: 'tax_id', label: 'CUIT', target: FIELD_TARGET.CLIENTE, type: FIELD_TYPE.TEXT, requestable: false },
  { key: 'contact_name', label: 'Contacto', target: FIELD_TARGET.CLIENTE, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'contact_phone', label: 'Teléfono', target: FIELD_TARGET.CLIENTE, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'contact_email', label: 'Email', target: FIELD_TARGET.CLIENTE, type: FIELD_TYPE.EMAIL, requestable: true },
  { key: 'address', label: 'Dirección', target: FIELD_TARGET.CLIENTE, type: FIELD_TYPE.TEXT, requestable: false },
  { key: 'city', label: 'Ciudad', target: FIELD_TARGET.CLIENTE, type: FIELD_TYPE.TEXT, requestable: false },

  { key: 'service_start_date', label: 'Inicio del Servicio', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.ADMINISTRATIVOS, type: FIELD_TYPE.DATE, requestable: false },
  { key: 'service_end_date', label: 'Fin del Servicio', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.ADMINISTRATIVOS, type: FIELD_TYPE.DATE, requestable: false },
  { key: 'purchase_order', label: 'Orden de Compra', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.ADMINISTRATIVOS, type: FIELD_TYPE.TEXT, requestable: false },
  { key: 'monthly_visits', label: 'Cantidad de Visitas Mensuales', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.ADMINISTRATIVOS, type: FIELD_TYPE.NUMBER, requestable: false },

  { key: 'motor', label: 'Motor', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.PRINCIPALES, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'serial_number', label: 'N° de Serie', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.PRINCIPALES, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'generador', label: 'Generador', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.PRINCIPALES, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'power_kva', label: 'Potencia (kVA)', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.PRINCIPALES, type: FIELD_TYPE.NUMBER, requestable: true },
  { key: 'fuel_type', label: 'Combustible', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.PRINCIPALES, type: FIELD_TYPE.FUEL, requestable: true },

  { key: 'fuel_filter_spec', label: 'Filtro de Combustible', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'oil_filter_spec', label: 'Filtro de Aceite', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'air_filter_spec', label: 'Filtro de Aire', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'coolant_capacity', label: 'Cantidad de Agua', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
  // Un equipo a gas no tiene tanque.
  { key: 'fuel_capacity', label: 'Tamaño de Tanque (Litros)', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.NUMBER, requestable: true, appliesTo: (equipment) => !isGasEquipment(equipment) },
  { key: 'oil_capacity', label: 'Cantidad de Aceite', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'battery_quantity', label: 'Cantidad de Baterías', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
  { key: 'battery_size', label: 'Medida de Batería', target: FIELD_TARGET.EQUIPO, section: EQUIPMENT_SECTION.SECUNDARIOS, type: FIELD_TYPE.TEXT, requestable: true },
]

const FIELDS_BY_KEY = new Map(MISSING_DATA_FIELDS.map((field) => [field.key, field]))
const CLIENT_FIELDS = MISSING_DATA_FIELDS.filter((field) => field.target === FIELD_TARGET.CLIENTE)
const EQUIPMENT_FIELDS = MISSING_DATA_FIELDS.filter((field) => field.target === FIELD_TARGET.EQUIPO)

export function getMissingDataField(key) {
  return FIELDS_BY_KEY.get(key) ?? null
}

// Fuera de la ficha del cliente, "Teléfono" solo no alcanza: en el formulario
// del tecnico y en el detalle de la visita se aclara que es del cliente.
export function fieldDisplayLabel(field) {
  return field.target === FIELD_TARGET.CLIENTE ? `${field.label} del cliente` : field.label
}

// Vacio o con solo espacios: los formularios guardan '' en vez de null.
function isMissing(value) {
  return value == null || String(value).trim() === ''
}

function missingFields(record, fields) {
  return fields.filter((field) => (field.appliesTo?.(record) ?? true) && isMissing(record[field.key]))
}

// Lo que falta cargar, por cliente activo (por nombre) y por equipo, agrupado
// por seccion de la ficha. Solo entra lo que tiene algo pendiente.
export function buildMissingDataReport(clients, equipment) {
  const equipmentByClient = new Map()
  for (const item of equipment) {
    if (!equipmentByClient.has(item.client_id)) equipmentByClient.set(item.client_id, [])
    equipmentByClient.get(item.client_id).push(item)
  }

  const groups = clients
    .filter(isActiveClient)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((client) => {
      const equipmentGroups = (equipmentByClient.get(client.id) ?? [])
        .map((item) => {
          const missing = missingFields(item, EQUIPMENT_FIELDS)
          const sections = Object.values(EQUIPMENT_SECTION)
            .map((title) => ({ title, fields: missing.filter((field) => field.section === title) }))
            .filter((section) => section.fields.length > 0)
          return { item, missing, sections, requestedKeys: item.requested_data_fields ?? [] }
        })
        .filter((group) => group.missing.length > 0)
        .sort((a, b) => (a.item.motor ?? '').localeCompare(b.item.motor ?? '', 'es'))
      return { client, missingClientFields: missingFields(client, CLIENT_FIELDS), equipment: equipmentGroups }
    })
    .filter((group) => group.missingClientFields.length > 0 || group.equipment.length > 0)

  return {
    clients: groups,
    clientCount: groups.length,
    equipmentCount: groups.reduce((sum, group) => sum + group.equipment.length, 0),
  }
}

// Lo que se le puede pedir al tecnico sobre un equipo: lo que le falta de la
// ficha tecnica y del contacto del cliente, mas lo que ya estaba pedido (asi
// se puede sacar del pedido aunque mientras tanto se haya completado).
export function requestableFieldsFor(equipmentGroup, missingClientFields) {
  const keys = new Set([
    ...equipmentGroup.missing.filter((field) => field.requestable).map((field) => field.key),
    ...missingClientFields.filter((field) => field.requestable).map((field) => field.key),
    ...equipmentGroup.requestedKeys,
  ])
  return MISSING_DATA_FIELDS.filter((field) => keys.has(field.key))
}

function toNumber(value) {
  const number = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

// Lo que cargo el tecnico (visits.collected_data), listo para copiar al
// recibir la visita: separado en cambios del equipo y del cliente, con los
// numeros convertidos. Lo vacio o invalido no se copia y sigue pedido.
export function collectedDataChanges(collectedData) {
  const equipment = {}
  const client = {}
  const keys = []
  for (const [key, rawValue] of Object.entries(collectedData ?? {})) {
    const field = getMissingDataField(key)
    if (!field?.requestable || isMissing(rawValue)) continue
    let value = String(rawValue).trim()
    if (field.type === FIELD_TYPE.NUMBER) value = toNumber(value)
    if (field.type === FIELD_TYPE.FUEL && !Object.values(FUEL_TYPE).includes(value)) value = null
    if (value === null) continue
    if (field.target === FIELD_TARGET.CLIENTE) client[key] = value
    else equipment[key] = value
    keys.push(key)
  }
  return { equipment, client, keys }
}

// Filas para mostrar lo relevado: dato y valor, en el orden del catalogo.
export function collectedDataRows(collectedData) {
  return MISSING_DATA_FIELDS.filter((field) => !isMissing(collectedData?.[field.key])).map((field) => {
    const value = String(collectedData[field.key]).trim()
    return {
      key: field.key,
      label: fieldDisplayLabel(field),
      value: field.type === FIELD_TYPE.FUEL ? (FUEL_TYPE_LABELS[value] ?? value) : value,
    }
  })
}
