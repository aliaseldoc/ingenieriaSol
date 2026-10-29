// Documento Excel de los services de aceite y baterias vencidos o por vencer,
// por cliente (pedido del 23/10/2026). Puro, como equipmentReportXlsx.js. La
// fecha es la del seguimiento de la ficha ("Próx. Cambio ...") y el estado
// sale de getAlertLevel: la misma regla de las alertas de Seguimiento. Desde
// el 28/10/2026 tambien entran los que tienen la fecha incompleta ("Sin
// fecha"), lleva una columna "Observaciones" para completar a mano, no muestra
// el codigo del equipo y tiene formato de tabla (tableData en xlsxCells.js).
import { dateCell, numberCell, tableColumns, tableData, textCell } from '../../lib/xlsxCells.js'
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

// Fecha del ultimo cambio o del proximo sin cargar: no se sabe si esta vencido.
const SIN_FECHA = 'sin_fecha'

// Entran estos dos niveles de getAlertLevel y los que no tienen fecha.
const STATUS_LABELS = { vencido: 'Vencido', proximo: 'Por vencer', [SIN_FECHA]: 'Sin fecha' }


const COLUMNS = [
  { header: 'Cliente', width: 30, cell: (row) => textCell(row.client.name) },
  { header: 'Contacto', width: 22, cell: (row) => textCell(row.client.contact_name) },
  { header: 'Teléfono', width: 16, cell: (row) => textCell(row.client.contact_phone) },
  { header: 'Motor', width: 24, cell: (row) => textCell(row.item.motor) },
  { header: 'Service', width: 10, cell: (row) => textCell(row.service.label) },
  { header: 'Estado', width: 11, cell: (row) => textCell(STATUS_LABELS[row.status]) },
  { header: 'Último Cambio', width: 13, cell: (row) => dateCell(row.item[row.service.changedAtField]) },
  { header: 'Vencimiento', width: 13, cell: (row) => dateCell(row.item[row.service.nextDueField]) },
  { header: 'Días de Atraso', width: 10, cell: (row) => numberCell(row.daysOverdue) },
  { header: 'Cantidad', width: 10, cell: (row) => numberCell(row.item[row.service.quantityField]) },
  { header: 'Filtro / Medida', width: 32, cell: (row) => textCell(row.item[row.service.specField]) },
  { header: 'Observaciones', width: 36, cell: () => null },
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

// Una fila por service vencido, por vencer o con la fecha incompleta (sin la
// del ultimo cambio o sin la del proximo) de los equipos de clientes activos.
// Si el vencimiento esta cargado y ya marca vencido o por vencer, sale asi
// aunque falte la fecha del ultimo cambio.
export function buildOverdueServiceRows(equipment, clients, today = new Date()) {
  const clientsById = new Map(clients.map((client) => [client.id, client]))
  const rows = []
  for (const item of equipment) {
    const client = clientsById.get(item.client_id)
    if (!client || !isActiveClient(client)) continue
    for (const service of SERVICES) {
      const dueDate = item[service.nextDueField] ? parseDateInput(item[service.nextDueField]) : null
      const incomplete = !item[service.changedAtField] || !dueDate
      const alertLevel = getAlertLevel(dueDate, today)
      const status = !STATUS_LABELS[alertLevel] && incomplete ? SIN_FECHA : alertLevel
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
  return [
    {
      sheet: 'Vencidos',
      data: tableData(
        COLUMNS.map((column) => column.header),
        rows.map((row) => COLUMNS.map((column) => column.cell(row)))
      ),
      columns: tableColumns(COLUMNS.map((column) => column.width)),
      stickyRowsCount: 1,
    },
  ]
}
