// Documento Excel del inventario de equipos. Puro: devuelve la definicion de la
// hoja para write-excel-file, sin importar la libreria (ver xlsxCells.js).
// Las fechas salen como fechas reales y las horas de uso como numero, asi se
// pueden ordenar y filtrar en Excel; el combustible queda como texto porque
// lleva su unidad ("120 L" o "80%").
import { dateCell, headerCell, numberCell, textCell } from '../../lib/xlsxCells.js'
import { CONDITION_STATUS_LABELS, formatFuelLevel } from '../../lib/constants.js'

const COLUMNS = [
  { header: 'Cliente', width: 30, cell: (item) => textCell(item.clients?.name) },
  { header: 'Motor', width: 22, cell: (item) => textCell(item.motor) },
  { header: 'Generador', width: 22, cell: (item) => textCell(item.generador) },
  { header: 'N° de Serie', width: 18, cell: (item) => textCell(item.serial_number) },
  { header: 'Condición', width: 16, cell: (item) => textCell(CONDITION_STATUS_LABELS[item.condition_status]) },
  { header: 'Horas de Uso', width: 13, cell: (item) => numberCell(item.hours_of_use) },
  { header: 'Nivel de Combustible', width: 20, cell: (item) => textCell(formatFuelLevel(item)) },
  { header: 'Último Service', width: 15, cell: (item) => dateCell(item.last_service_date) },
  { header: 'Cambio Filtro de Combustible', width: 16, cell: (item) => dateCell(item.fuel_filter_changed_at) },
  { header: 'Próx. Cambio Filtro de Combustible', width: 16, cell: (item) => dateCell(item.fuel_filter_next_due_at) },
  { header: 'Cambio Filtro de Aceite', width: 16, cell: (item) => dateCell(item.oil_filter_changed_at) },
  { header: 'Próx. Cambio Filtro de Aceite', width: 16, cell: (item) => dateCell(item.oil_filter_next_due_at) },
  { header: 'Cambio Filtro de Aire', width: 16, cell: (item) => dateCell(item.air_filter_changed_at) },
  { header: 'Próx. Cambio Filtro de Aire', width: 16, cell: (item) => dateCell(item.air_filter_next_due_at) },
  { header: 'Cambio de Batería', width: 16, cell: (item) => dateCell(item.battery_changed_at) },
  { header: 'Próx. Cambio de Batería', width: 16, cell: (item) => dateCell(item.battery_next_due_at) },
]

function byClientThenMotor(a, b) {
  const clientCompare = (a.clients?.name ?? '').localeCompare(b.clients?.name ?? '', 'es')
  return clientCompare !== 0 ? clientCompare : (a.motor ?? '').localeCompare(b.motor ?? '', 'es')
}

// Con la fecha local: toISOString() es UTC, y de noche en Argentina el archivo
// saldria con la fecha de mañana.
export function equipmentReportFileName(today = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `reporte-equipos-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.xlsx`
}

export function buildEquipmentReportSheets(equipment) {
  // Los encabezados largos de las fechas se parten en dos renglones.
  const header = COLUMNS.map((column) => ({ ...headerCell(column.header), wrap: true }))
  const data = [...equipment].sort(byClientThenMotor).map((item) => COLUMNS.map((column) => column.cell(item)))
  return [
    {
      sheet: 'Equipos',
      data: [header, ...data],
      columns: COLUMNS.map((column) => ({ width: column.width })),
      stickyRowsCount: 1,
    },
  ]
}
