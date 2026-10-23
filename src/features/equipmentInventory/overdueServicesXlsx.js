// Documento Excel de los services de aceite y baterias vencidos o por vencer,
// por cliente (pedido del 23/10/2026). Puro, como equipmentReportXlsx.js. La
// fecha es la del seguimiento de la ficha ("Próx. Cambio ...") y el estado
// sale de getAlertLevel: la misma regla de las alertas del Panel de Control.
import { dateCell, headerCell, numberCell, textCell } from '../../lib/xlsxCells.js'
import { isActiveClient } from '../../lib/constants.js'
import { daysBetween, getAlertLevel, parseDateInput, toISODateString } from '../../lib/dateUtils.js'

// Los dos services del listado, en el orden en que salen dentro de cada equipo.
const SERVICES = [
  {
    label: 'Aceite',
    changedAtField: 'oil_filter_changed_at',
    nextDueField: 'oil_filter_next_due_at',
    quantityField: 'oil_capacity',
    specField: 'oil_filter_spec',
  },
  {
    label: 'Baterías',
    changedAtField: 'battery_changed_at',
    nextDueField: 'battery_next_due_at',
    quantityField: 'battery_quantity',
    specField: 'battery_size',
  },
]

// Solo entran estos dos niveles de getAlertLevel.
const STATUS_LABELS = { vencido: 'Vencido', proximo: 'Por vencer' }

const COLUMNS = [
  { header: 'Cliente', width: 30, cell: (row) => textCell(row.client.name) },
  { header: 'Contacto', width: 22, cell: (row) => textCell(row.client.contact_name) },
  { header: 'Teléfono', width: 16, cell: (row) => textCell(row.client.contact_phone) },
  { header: 'Código', width: 11, cell: (row) => textCell(row.item.internal_code) },
  { header: 'Motor', width: 24, cell: (row) => textCell(row.item.motor) },
  { header: 'Service', width: 10, cell: (row) => textCell(row.service.label) },
  { header: 'Estado', width: 11, cell: (row) => textCell(STATUS_LABELS[row.status]) },
  { header: 'Último Cambio', width: 13, cell: (row) => dateCell(row.item[row.service.changedAtField]) },
  { header: 'Vencimiento', width: 13, cell: (row) => dateCell(row.item[row.service.nextDueField]) },
  { header: 'Días de Atraso', width: 10, cell: (row) => numberCell(row.daysOverdue) },
  { header: 'Cantidad', width: 10, cell: (row) => numberCell(row.item[row.service.quantityField]) },
  { header: 'Filtro / Medida', width: 32, cell: (row) => textCell(row.item[row.service.specField]) },
]

// Por cliente, por motor (con el codigo para que las filas de un mismo equipo
// queden juntas) y primero Aceite.
function compareRows(a, b) {
  return (
    a.client.name.localeCompare(b.client.name, 'es') ||
    (a.item.motor ?? '').localeCompare(b.item.motor ?? '', 'es') ||
    (a.item.internal_code ?? '').localeCompare(b.item.internal_code ?? '', 'es') ||
    SERVICES.indexOf(a.service) - SERVICES.indexOf(b.service)
  )
}

// Una fila por service vencido o por vencer de los equipos de clientes
// activos. Sin fecha de vencimiento no entra.
export function buildOverdueServiceRows(equipment, clients, today = new Date()) {
  const clientsById = new Map(clients.map((client) => [client.id, client]))
  const rows = []
  for (const item of equipment) {
    const client = clientsById.get(item.client_id)
    if (!client || !isActiveClient(client)) continue
    for (const service of SERVICES) {
      const dueDate = item[service.nextDueField] ? parseDateInput(item[service.nextDueField]) : null
      const status = getAlertLevel(dueDate, today)
      if (!STATUS_LABELS[status]) continue
      const daysOverdue = status === 'vencido' ? daysBetween(dueDate, today) : null
      rows.push({ client, item, service, status, daysOverdue })
    }
  }
  return rows.sort(compareRows)
}

export function overdueServicesFileName(today = new Date()) {
  return `services-vencidos-${toISODateString(today)}.xlsx`
}

export function buildOverdueServicesSheets(rows) {
  // Los encabezados largos se parten en dos renglones.
  const header = COLUMNS.map((column) => ({ ...headerCell(column.header), wrap: true }))
  const data = rows.map((row) => COLUMNS.map((column) => column.cell(row)))
  return [
    {
      sheet: 'Vencidos',
      data: [header, ...data],
      columns: COLUMNS.map((column) => ({ width: column.width })),
      stickyRowsCount: 1,
    },
  ]
}
