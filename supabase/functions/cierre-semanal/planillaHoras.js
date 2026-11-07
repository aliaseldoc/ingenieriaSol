// La hoja de una semana en la planilla de Drive del reporte de horas (pedido
// del 04/11/2026), como pedidos a la API de Google Sheets. Puro, sin red: lo
// prueba Node. Lo comun con la planilla de vencidos esta en
// ../_shared/hojasGoogle.js.
//
// Cada hoja se llama "Semana DD-MM-AAAA" (el lunes) y es la misma hoja que el
// Excel del mail (buildWeeklyReportLayout): resumen arriba, con "Valor hora" y
// "Total a pagar", y el detalle por dia abajo. El valor hora se escribe en la
// planilla y pasa a la hoja siguiente por la columna oculta "Clave" (el id del
// empleado), a la derecha de las dos tablas.
//
// Con extension explicita en los imports: Deno no adivina el ".js".
import { HOURLY_RATE_HEADER, buildWeeklyReportLayout } from '../../../src/features/timesheet/weeklyReportXlsx.js'
import {
  BODY_FORMAT,
  HEADER_FORMAT,
  HEADER_HEIGHT,
  KEY_HEADER,
  TITLE_FORMAT,
  addSheetRequest,
  cellData,
  columnWidthRequests,
  datedSheetIndex,
  datedSheetTitle,
  finishSheetRequests,
  hideColumnRequest,
  latestDatedSheet,
  rowHeightRequest,
  tableFormatRequests,
  textCellData,
  valuesByKey,
  writeRowsRequest,
} from '../_shared/hojasGoogle.js'

const TITLE_PREFIX = 'Semana '

// 'AAAA-MM-DD' del lunes -> "Semana DD-MM-AAAA".
export function weekSheetTitle(weekStartKey) {
  return datedSheetTitle(TITLE_PREFIX, weekStartKey)
}

// La hoja de la que se copia el valor hora: la de la semana mas reciente hasta
// esta, que es esta misma si se vuelve a mandar.
export function latestWeekSheet(sheets, weekStartKey) {
  return latestDatedSheet(sheets, TITLE_PREFIX, weekStartKey)
}

export function weekSheetIndex(sheets, weekStartKey, replaceSheetId) {
  return datedSheetIndex(sheets, TITLE_PREFIX, weekStartKey, replaceSheetId)
}

// Valor hora cargado en cada fila del resumen, por empleado. Se lee sin
// formato (numeros): lo que no es un numero no se copia.
export function hourlyRatesByKey(values) {
  return valuesByKey(values, HOURLY_RATE_HEADER, (value) => {
    if (value == null || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  })
}

// Los pedidos para escribir la hoja de la semana. rows: las filas de la foto
// del cierre. hourlyRates: Map employeeId -> valor hora.
export function buildWeekSheetRequests({ rows, hourlyRates = new Map(), title, sheetId, replaceSheetId = null, index = 0 }) {
  const layout = buildWeeklyReportLayout(rows, hourlyRates)
  const keyColumn = layout.widths.length
  const columnCount = keyColumn + 1
  const summaryColumns = layout.summary.headers.length
  const detailColumns = layout.detail.headers.length

  // La clave va en la ultima columna; en el medio, celdas que no se tocan.
  const withKey = (values, key) => [...values, ...Array.from({ length: keyColumn - values.length }, () => ({})), textCellData(key, BODY_FORMAT)]
  const sheetRows = [
    { values: withKey(layout.summary.headers.map((header) => textCellData(header, HEADER_FORMAT)), KEY_HEADER) },
    ...layout.summary.rows.map((row) => ({ values: withKey(row.cells.map((cell) => cellData(cell, BODY_FORMAT)), row.key) })),
  ]
  while (sheetRows.length < layout.detailTitle.row) sheetRows.push({ values: [] })
  sheetRows.push({ values: [textCellData(layout.detailTitle.text, TITLE_FORMAT)] })
  sheetRows.push({ values: layout.detail.headers.map((header) => textCellData(header, HEADER_FORMAT)) })
  for (const cells of layout.detail.rows) sheetRows.push({ values: cells.map((cell) => cellData(cell, BODY_FORMAT)) })

  return [
    // Sin filas congeladas: al bajar al detalle, el encabezado del resumen confundiria.
    addSheetRequest({ sheetId, title, replaceSheetId, rowCount: sheetRows.length, columnCount, index, frozenRowCount: 0 }),
    writeRowsRequest(sheetId, 0, sheetRows),
    ...tableFormatRequests({ sheetId, startRow: layout.summary.startRow, rowCount: 1 + layout.summary.rows.length, columnCount: summaryColumns }),
    ...tableFormatRequests({ sheetId, startRow: layout.detail.startRow, rowCount: 1 + layout.detail.rows.length, columnCount: detailColumns }),
    ...columnWidthRequests(sheetId, layout.widths),
    hideColumnRequest(sheetId, keyColumn),
    rowHeightRequest(sheetId, layout.summary.startRow, HEADER_HEIGHT),
    rowHeightRequest(sheetId, layout.detail.startRow, HEADER_HEIGHT),
    ...finishSheetRequests({ sheetId, title, replaceSheetId }),
  ]
}
