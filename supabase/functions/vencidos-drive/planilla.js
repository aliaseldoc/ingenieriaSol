// La hoja de la planilla de Drive con los services vencidos, como pedidos a la
// API de Google Sheets (spreadsheets.batchUpdate). Puro, sin red: lo prueba
// Node igual que el armado de la tabla. Lo comun con la planilla del reporte de
// horas esta en ../_shared/hojasGoogle.js.
//
// Cada hoja se llama "Vencidos DD-MM-AAAA" y va primera. Tiene el mismo
// formato que tenia el Excel y una ultima columna oculta, "Clave", que dice de
// que equipo y service es cada fila: con ella la hoja siguiente encuentra las
// observaciones aunque alguien haya ordenado las filas.
import {
  BODY_FORMAT,
  HEADER_FORMAT,
  HEADER_HEIGHT,
  KEY_HEADER,
  WRAP_FORMAT,
  addSheetRequest,
  cellData,
  columnWidthRequests,
  datedSheetKey,
  datedSheetTitle,
  finishSheetRequests,
  hideColumnRequest,
  latestDatedSheet,
  newSheetId,
  rowHeightRequest,
  sheetRange,
  tableFormatRequests,
  textCellData,
  valuesByKey,
  writeRowsRequest,
} from '../_shared/hojasGoogle.js'

export { KEY_HEADER, newSheetId, sheetRange }

export const OBSERVATIONS_HEADER = 'Observaciones'

const TITLE_PREFIX = 'Vencidos '

// 'AAAA-MM-DD' a "Vencidos DD-MM-AAAA".
export function sheetTitle(dateKey) {
  return datedSheetTitle(TITLE_PREFIX, dateKey)
}

export function sheetDateKey(title) {
  return datedSheetKey(TITLE_PREFIX, title)
}

// La hoja de la que se copian las observaciones: la de fecha mas reciente
// hasta hoy, que es la de hoy si ya se actualizo en el dia.
export function latestSheet(sheets, todayKey) {
  return latestDatedSheet(sheets, TITLE_PREFIX, todayKey)
}

// Observacion escrita en cada fila de una hoja, por su clave.
export function observationsByKey(values) {
  return valuesByKey(values, OBSERVATIONS_HEADER)
}

// Los pedidos para agregar la hoja del dia (reemplazando la de hoy si ya habia
// una: replaceSheetId).
export function buildSheetRequests({ table, title, sheetId, replaceSheetId = null }) {
  const headers = [...table.headers, KEY_HEADER]
  const notesIndex = table.headers.indexOf(OBSERVATIONS_HEADER)
  const rows = [
    { values: headers.map((header) => textCellData(header, HEADER_FORMAT)) },
    ...table.rows.map((row) => ({
      values: [
        ...row.cells.map((cell, index) => cellData(cell, index === notesIndex ? WRAP_FORMAT : BODY_FORMAT)),
        textCellData(row.key, BODY_FORMAT),
      ],
    })),
  ]
  return [
    addSheetRequest({ sheetId, title, replaceSheetId, rowCount: rows.length, columnCount: headers.length }),
    writeRowsRequest(sheetId, 0, rows),
    ...tableFormatRequests({ sheetId, startRow: 0, rowCount: rows.length, columnCount: headers.length }),
    ...columnWidthRequests(sheetId, table.widths),
    hideColumnRequest(sheetId, headers.length - 1),
    rowHeightRequest(sheetId, 0, HEADER_HEIGHT),
    ...finishSheetRequests({ sheetId, title, replaceSheetId }),
  ]
}
