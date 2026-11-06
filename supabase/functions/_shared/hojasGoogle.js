// Piezas comunes de las planillas de Google que escriben las Edge Functions
// (services vencidos y reporte semanal de horas): pedidos a la API de Google
// Sheets (spreadsheets.batchUpdate), sin red. Puro: lo prueba Node.
//
// Cada planilla tiene una hoja por fecha ("Vencidos 30-10-2026", "Semana
// 02-11-2026"), la mas nueva primera, con el mismo formato de tabla que los
// Excel de la app: encabezado verde oscuro con letra blanca, filas alternadas en
// dos verdes claros, bordes finos y letra de 14. Las celdas son las de
// src/lib/xlsxCells.js ({ value, type, format }).

export const KEY_HEADER = 'Clave'

const FONT_SIZE = 14
const HEADER_COLOR = '#1f4a3d'
const HEADER_TEXT_COLOR = '#ffffff'
const BAND_COLORS = ['#d9eadf', '#f0f7f2']
const BORDER_COLOR = '#b5cbbd'
// Los anchos de las tablas estan en caracteres de la letra de 11 del Excel;
// con la de 14, cada caracter ocupa unos 9 pixeles.
const PIXELS_PER_CHARACTER = 9
// Dos renglones de encabezado con la letra de 14 ("Días de Atraso").
export const HEADER_HEIGHT = 56
// Las fechas van como numero de serie (dias desde el 30/12/1899), igual que en Excel.
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86400000

// Formatos de numero de xlsxCells.js con su tipo en Google Sheets.
const NUMBER_FORMAT_TYPES = {
  'dd/mm/yyyy': 'DATE',
  '[h]:mm': 'TIME',
}

// prefijo + 'AAAA-MM-DD' -> "Vencidos DD-MM-AAAA" (el nombre de una hoja no admite "/").
export function datedSheetTitle(prefix, dateKey) {
  const [year, month, day] = dateKey.split('-')
  return `${prefix}${day}-${month}-${year}`
}

export function datedSheetKey(prefix, title) {
  const text = String(title ?? '').trim()
  if (!text.startsWith(prefix)) return null
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text.slice(prefix.length))
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

// La hoja de fecha mas reciente hasta `uptoKey` (inclusive). Las hojas con
// otro nombre (las que agregue la gente) no cuentan.
export function latestDatedSheet(sheets, prefix, uptoKey) {
  let latest = null
  for (const sheet of sheets) {
    const dateKey = datedSheetKey(prefix, sheet.title)
    if (!dateKey || dateKey > uptoKey) continue
    if (!latest || dateKey > latest.dateKey) latest = { ...sheet, dateKey }
  }
  return latest
}

// Rango A1 de una hoja entera: el nombre va entre comillas simples.
export function sheetRange(title) {
  return `'${title.replaceAll("'", "''")}'`
}

// Un id de hoja que no use ninguna otra (Google acepta cualquier entero positivo).
export function newSheetId(sheets, random = Math.random) {
  const usedIds = new Set(sheets.map((sheet) => sheet.sheetId))
  for (;;) {
    const sheetId = Math.floor(random() * 2000000000) + 1
    if (!usedIds.has(sheetId)) return sheetId
  }
}

// Lo que se escribio en la columna `valueHeader` de cada fila, por su clave
// (columna "Clave"). Las columnas se buscan por el encabezado de la primera
// fila, asi no importa si alguien agrego otra en el medio. `parse` convierte el
// valor; lo que devuelve null o '' no se guarda.
export function valuesByKey(values, valueHeader, parse = (value) => String(value ?? '').trim()) {
  const [headers = [], ...rows] = values ?? []
  const titles = headers.map((header) => String(header ?? '').trim())
  const keyIndex = titles.indexOf(KEY_HEADER)
  const valueIndex = titles.indexOf(valueHeader)
  const result = new Map()
  if (keyIndex < 0 || valueIndex < 0) return result
  for (const row of rows) {
    const key = String(row[keyIndex] ?? '').trim()
    const value = parse(row[valueIndex])
    if (key && value !== null && value !== '') result.set(key, value)
  }
  return result
}

export function colorStyle(hex) {
  const channel = (start) => parseInt(hex.slice(start, start + 2), 16) / 255
  return { rgbColor: { red: channel(1), green: channel(3), blue: channel(5) } }
}

export const BODY_FORMAT = { textFormat: { fontSize: FONT_SIZE }, verticalAlignment: 'MIDDLE' }
export const WRAP_FORMAT = { ...BODY_FORMAT, wrapStrategy: 'WRAP' }
export const HEADER_FORMAT = {
  textFormat: { fontSize: FONT_SIZE, bold: true, foregroundColorStyle: colorStyle(HEADER_TEXT_COLOR) },
  verticalAlignment: 'MIDDLE',
  wrapStrategy: 'WRAP',
}
export const TITLE_FORMAT = { textFormat: { fontSize: FONT_SIZE, bold: true }, verticalAlignment: 'MIDDLE' }
const BORDER = { style: 'SOLID', colorStyle: colorStyle(BORDER_COLOR) }

function numberFormatFor(cell) {
  if (cell.type === Date) return { type: 'DATE', pattern: cell.format ?? 'dd/mm/yyyy' }
  if (!cell.format) return null
  return { type: NUMBER_FORMAT_TYPES[cell.format] ?? 'NUMBER', pattern: cell.format }
}

// Una celda de xlsxCells.js como CellData de Google Sheets. Una celda sin
// valor conserva su formato de numero (asi lo que se escriba a mano en "Valor
// hora" sale en pesos).
export function cellData(cell, format) {
  const numberFormat = cell ? numberFormatFor(cell) : null
  const userEnteredFormat = numberFormat ? { ...format, numberFormat } : format
  if (cell == null || cell.value == null) return { userEnteredFormat }
  let userEnteredValue
  if (cell.type === Date) userEnteredValue = { numberValue: (cell.value.getTime() - SERIAL_EPOCH_MS) / MS_PER_DAY }
  else if (cell.type === 'Formula') userEnteredValue = { formulaValue: cell.value }
  else if (cell.type === Number) userEnteredValue = { numberValue: cell.value }
  else userEnteredValue = { stringValue: String(cell.value) }
  return { userEnteredValue, userEnteredFormat }
}

export function textCellData(text, format) {
  return cellData({ value: text, type: String }, format)
}

// Donde va la hoja de `dateKey` para que las fechadas queden de la mas nueva a
// la mas vieja, aunque se rehaga una vieja: antes de la primera mas vieja, y si
// no hay, despues de la ultima mas nueva. Es la posicion en la planilla de hoy
// (con la hoja que se reemplaza todavia ahi), que es como la entiende Google al
// agregar una hoja. Las hojas tienen que traer su `index`.
export function datedSheetIndex(sheets, prefix, dateKey, replaceSheetId = null) {
  const dated = sheets
    .filter((sheet) => sheet.sheetId !== replaceSheetId)
    .map((sheet) => ({ index: sheet.index ?? 0, dateKey: datedSheetKey(prefix, sheet.title) }))
    .filter((sheet) => sheet.dateKey)
  const older = dated.filter((sheet) => sheet.dateKey < dateKey).map((sheet) => sheet.index)
  if (older.length > 0) return Math.min(...older)
  const newer = dated.filter((sheet) => sheet.dateKey > dateKey).map((sheet) => sheet.index)
  return newer.length > 0 ? Math.max(...newer) + 1 : 0
}

// La hoja nueva, en `index` (la primera, si no se dice otra cosa), con el
// encabezado congelado salvo que se pida otra cosa (frozenRowCount: 0 en una
// hoja con dos tablas, donde el encabezado de arriba confundiria al bajar). Si
// ya habia una con ese nombre (replaceSheetId), se crea con otro y
// finishSheetRequests borra la vieja y le pone el nombre: Google aplica todo
// el lote junto o nada, asi que la planilla nunca queda sin la hoja ni con dos.
export function addSheetRequest({ sheetId, title, replaceSheetId, rowCount, columnCount, index = 0, frozenRowCount = 1 }) {
  return {
    addSheet: {
      properties: {
        sheetId,
        title: replaceSheetId == null ? title : `${title} (nueva)`,
        index,
        // Una fila de mas como minimo: Google no deja congelar todas las filas.
        gridProperties: { rowCount: Math.max(rowCount, 2), columnCount, frozenRowCount },
      },
    },
  }
}

export function finishSheetRequests({ sheetId, title, replaceSheetId }) {
  if (replaceSheetId == null) return []
  return [
    { deleteSheet: { sheetId: replaceSheetId } },
    { updateSheetProperties: { properties: { sheetId, title }, fields: 'title' } },
  ]
}

// Escribe filas de CellData desde la fila `startRow` (0 = primera).
export function writeRowsRequest(sheetId, startRow, rows) {
  return { updateCells: { start: { sheetId, rowIndex: startRow, columnIndex: 0 }, rows, fields: 'userEnteredValue,userEnteredFormat' } }
}

// Formato de tabla para un bloque: encabezado (su primera fila) y filas
// alternadas, con bordes finos.
export function tableFormatRequests({ sheetId, startRow, rowCount, columnCount }) {
  const range = { sheetId, startRowIndex: startRow, endRowIndex: startRow + rowCount, startColumnIndex: 0, endColumnIndex: columnCount }
  return [
    {
      addBanding: {
        bandedRange: {
          range,
          rowProperties: {
            headerColorStyle: colorStyle(HEADER_COLOR),
            firstBandColorStyle: colorStyle(BAND_COLORS[0]),
            secondBandColorStyle: colorStyle(BAND_COLORS[1]),
          },
        },
      },
    },
    { updateBorders: { range, top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, innerHorizontal: BORDER, innerVertical: BORDER } },
  ]
}

function dimensionRequest(sheetId, dimension, index, properties, fields) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension, startIndex: index, endIndex: index + 1 },
      properties,
      fields,
    },
  }
}

// Anchos en caracteres (los mismos de los Excel) a pixeles.
export function columnWidthRequests(sheetId, widths) {
  return widths.map((width, index) =>
    dimensionRequest(sheetId, 'COLUMNS', index, { pixelSize: Math.round(width * PIXELS_PER_CHARACTER) }, 'pixelSize')
  )
}

export function hideColumnRequest(sheetId, index) {
  return dimensionRequest(sheetId, 'COLUMNS', index, { hiddenByUser: true }, 'hiddenByUser')
}

export function rowHeightRequest(sheetId, index, pixelSize) {
  return dimensionRequest(sheetId, 'ROWS', index, { pixelSize }, 'pixelSize')
}
