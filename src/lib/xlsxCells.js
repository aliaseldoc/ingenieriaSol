// Celdas para los documentos Excel (write-excel-file). Son objetos planos: este
// archivo no importa la libreria, asi el armado de cada documento es puro y lo
// pueden usar tanto el navegador (descarga) como la Edge Function de cierre
// semanal (adjunto del mail), cada uno con su propia entrada de la libreria.
// La Edge Function vencidos-drive tambien arma su tabla con estas celdas y las
// pasa a la planilla de Drive (ver supabase/functions/vencidos-drive/planilla.js).

export function headerCell(text) {
  return { value: text, type: String, fontWeight: 'bold', backgroundColor: '#e3ece7', bottomBorderStyle: 'thin' }
}

export function textCell(text) {
  if (text == null || text === '') return null
  return { value: String(text), type: String }
}

export function numberCell(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? { value: number, type: Number } : textCell(value)
}

// Las horas van como duracion de Excel (fraccion de dia) con formato [h]:mm:
// se ven como "9:30" igual que en la app, pero son numeros que el contador
// puede sumar. Con "h" sola Excel daria la vuelta a las 24 h.
export function durationCell(minutes) {
  return { value: (minutes ?? 0) / 1440, type: Number, format: '[h]:mm' }
}

// 'AAAA-MM-DD' (columna date de la base, o dateKey del motor de horas) a fecha
// real de Excel. Se arma en UTC porque la libreria convierte con getTime(): asi
// la fecha cae exacta en su dia, corra donde corra (navegador o servidor).
export function dateCell(dateKey) {
  if (!dateKey) return null
  const [year, month, day] = String(dateKey).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return { value: new Date(Date.UTC(year, month - 1, day)), type: Date, format: 'dd/mm/yyyy' }
}

// Formato de tabla de los documentos (pedido del 28/10/2026): encabezado verde
// oscuro con letra blanca, filas alternadas en dos verdes claros, bordes finos
// en todas las celdas (tambien en las vacias, asi la franja sigue de punta a
// punta) y letra de 14 (Excel abre con 11). La letra va en cada celda y no como
// opcion del archivo, asi quien lo escribe (el navegador o la Edge Function del
// cierre semanal) no tiene que acordarse de pasarla.
const TABLE_FONT_SIZE = 14
const TABLE_BORDER = { borderStyle: 'thin', borderColor: '#b5cbbd' }
const TABLE_HEADER = { backgroundColor: '#1f4a3d', textColor: '#ffffff', alignVertical: 'center', wrap: true }
const TABLE_BANDS = ['#d9eadf', '#f0f7f2']

function tableStyled(cell, style) {
  return { ...(cell ?? { value: null }), ...TABLE_BORDER, fontSize: TABLE_FONT_SIZE, ...style }
}

// La hoja con formato de tabla: el encabezado (textos; los largos se parten en
// dos renglones) y las filas de celdas armadas con las funciones de arriba.
export function tableData(headers, rows) {
  return [
    headers.map((text) => tableStyled(headerCell(text), TABLE_HEADER)),
    ...rows.map((cells, index) => cells.map((cell) => tableStyled(cell, { backgroundColor: TABLE_BANDS[index % 2] }))),
  ]
}

// Anchos de columna pensados para la letra de 11, agrandados para la de 14.
export function tableColumns(widths) {
  return widths.map((width) => ({ width: Math.round((width * TABLE_FONT_SIZE) / 11) }))
}
