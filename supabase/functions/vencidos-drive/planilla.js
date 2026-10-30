// La hoja de la planilla de Drive con los services vencidos, como pedidos a la
// API de Google Sheets (spreadsheets.batchUpdate). Puro, sin red: lo prueba
// Node igual que el armado de la tabla.
//
// Cada hoja se llama "Vencidos DD-MM-AAAA" y va primera. Tiene el mismo
// formato que tenia el Excel (encabezado verde oscuro con letra blanca, filas
// alternadas en dos verdes claros, bordes finos y letra de 14) y una ultima
// columna oculta, "Clave", que dice de que equipo y service es cada fila: con
// ella la hoja siguiente encuentra las observaciones aunque alguien haya
// ordenado las filas.

export const KEY_HEADER = 'Clave'
export const OBSERVATIONS_HEADER = 'Observaciones'

const TITLE_PREFIX = 'Vencidos '
const TITLE_PATTERN = /^Vencidos (\d{2})-(\d{2})-(\d{4})$/

const FONT_SIZE = 14
const HEADER_COLOR = '#1f4a3d'
const HEADER_TEXT_COLOR = '#ffffff'
const BAND_COLORS = ['#d9eadf', '#f0f7f2']
const BORDER_COLOR = '#b5cbbd'
// Los anchos de la tabla estan en caracteres de la letra de 11 del Excel; con
// la de 14, cada caracter ocupa unos 9 pixeles.
const PIXELS_PER_CHARACTER = 9
// Dos renglones de encabezado con la letra de 14 ("Días de Atraso").
const HEADER_HEIGHT = 56
// Las fechas van como numero de serie (dias desde el 30/12/1899), igual que en Excel.
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86400000

// 'AAAA-MM-DD' a "Vencidos DD-MM-AAAA" (el nombre de una hoja no admite "/").
export function sheetTitle(dateKey) {
  const [year, month, day] = dateKey.split('-')
  return `${TITLE_PREFIX}${day}-${month}-${year}`
}

export function sheetDateKey(title) {
  const match = TITLE_PATTERN.exec(String(title ?? '').trim())
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

// La hoja de la que se copian las observaciones: la de fecha mas reciente
// hasta hoy, que es la de hoy si ya se actualizo en el dia. Las hojas con
// otro nombre (las que agregue la gente) no cuentan.
export function latestSheet(sheets, todayKey) {
  let latest = null
  for (const sheet of sheets) {
    const dateKey = sheetDateKey(sheet.title)
    if (!dateKey || dateKey > todayKey) continue
    if (!latest || dateKey > latest.dateKey) latest = { ...sheet, dateKey }
  }
  return latest
}

// Rango A1 de una hoja entera: el nombre va entre comillas simples.
export function sheetRange(title) {
  return `'${title.replaceAll("'", "''")}'`
}

// Observacion escrita en cada fila de una hoja, por su clave. Las columnas se
// buscan por el encabezado, asi no importa si alguien agrego otra en el medio.
export function observationsByKey(values) {
  const [headers = [], ...rows] = values ?? []
  const titles = headers.map((header) => String(header ?? '').trim())
  const keyIndex = titles.indexOf(KEY_HEADER)
  const notesIndex = titles.indexOf(OBSERVATIONS_HEADER)
  const observations = new Map()
  if (keyIndex < 0 || notesIndex < 0) return observations
  for (const row of rows) {
    const key = String(row[keyIndex] ?? '').trim()
    const note = String(row[notesIndex] ?? '').trim()
    if (key && note) observations.set(key, note)
  }
  return observations
}

// Un id de hoja que no use ninguna otra (Google acepta cualquier entero positivo).
export function newSheetId(sheets, random = Math.random) {
  const usedIds = new Set(sheets.map((sheet) => sheet.sheetId))
  for (;;) {
    const sheetId = Math.floor(random() * 2000000000) + 1
    if (!usedIds.has(sheetId)) return sheetId
  }
}

function colorStyle(hex) {
  const channel = (start) => parseInt(hex.slice(start, start + 2), 16) / 255
  return { rgbColor: { red: channel(1), green: channel(3), blue: channel(5) } }
}

const BODY_FORMAT = { textFormat: { fontSize: FONT_SIZE }, verticalAlignment: 'MIDDLE' }
const NOTES_FORMAT = { ...BODY_FORMAT, wrapStrategy: 'WRAP' }
const HEADER_FORMAT = {
  textFormat: { fontSize: FONT_SIZE, bold: true, foregroundColorStyle: colorStyle(HEADER_TEXT_COLOR) },
  verticalAlignment: 'MIDDLE',
  wrapStrategy: 'WRAP',
}
const DATE_FORMAT = { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } }
const BORDER = { style: 'SOLID', colorStyle: colorStyle(BORDER_COLOR) }

// Las celdas de la tabla son las de src/lib/xlsxCells.js ({ value, type }).
function cellData(cell, format) {
  if (cell == null || cell.value == null) return { userEnteredFormat: format }
  if (cell.type === Date) {
    return {
      userEnteredValue: { numberValue: (cell.value.getTime() - SERIAL_EPOCH_MS) / MS_PER_DAY },
      userEnteredFormat: { ...format, ...DATE_FORMAT },
    }
  }
  const userEnteredValue = cell.type === Number ? { numberValue: cell.value } : { stringValue: String(cell.value) }
  return { userEnteredValue, userEnteredFormat: format }
}

function textCellData(text, format) {
  return cellData({ value: text, type: String }, format)
}

function columnProperties(sheetId, index, properties, fields) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
      properties,
      fields,
    },
  }
}

// Los pedidos para agregar la hoja del dia. Si ya habia una con ese nombre
// (replaceSheetId), la nueva se crea con otro nombre, se borra la vieja y
// recien entonces toma el suyo: Google aplica todo el lote junto o nada, asi
// que la planilla nunca queda sin la hoja ni con dos.
export function buildSheetRequests({ table, title, sheetId, replaceSheetId = null }) {
  const headers = [...table.headers, KEY_HEADER]
  const notesIndex = table.headers.indexOf(OBSERVATIONS_HEADER)
  const keyIndex = headers.length - 1
  const range = { sheetId, startRowIndex: 0, endRowIndex: table.rows.length + 1, startColumnIndex: 0, endColumnIndex: headers.length }
  const rows = [
    { values: headers.map((header) => textCellData(header, HEADER_FORMAT)) },
    ...table.rows.map((row) => ({
      values: [
        ...row.cells.map((cell, index) => cellData(cell, index === notesIndex ? NOTES_FORMAT : BODY_FORMAT)),
        textCellData(row.key, BODY_FORMAT),
      ],
    })),
  ]

  const requests = [
    {
      addSheet: {
        properties: {
          sheetId,
          title: replaceSheetId == null ? title : `${title} (nueva)`,
          index: 0,
          // Una fila de mas si no hay ningun vencido: Google no deja congelar todas las filas.
          gridProperties: { rowCount: Math.max(rows.length, 2), columnCount: headers.length, frozenRowCount: 1 },
        },
      },
    },
    { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows, fields: 'userEnteredValue,userEnteredFormat' } },
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
    {
      updateBorders: { range, top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, innerHorizontal: BORDER, innerVertical: BORDER },
    },
    ...table.widths.map((width, index) =>
      columnProperties(sheetId, index, { pixelSize: Math.round(width * PIXELS_PER_CHARACTER) }, 'pixelSize')
    ),
    columnProperties(sheetId, keyIndex, { hiddenByUser: true }, 'hiddenByUser'),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: HEADER_HEIGHT },
        fields: 'pixelSize',
      },
    },
  ]
  if (replaceSheetId != null) {
    requests.push(
      { deleteSheet: { sheetId: replaceSheetId } },
      { updateSheetProperties: { properties: { sheetId, title, index: 0 }, fields: 'title,index' } }
    )
  }
  return requests
}
