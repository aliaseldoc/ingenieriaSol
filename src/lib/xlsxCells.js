// Celdas para los documentos Excel (write-excel-file). Son objetos planos: este
// archivo no importa la libreria, asi el armado de cada documento es puro y lo
// pueden usar tanto el navegador (descarga) como la Edge Function de cierre
// semanal (adjunto del mail), cada uno con su propia entrada de la libreria.

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
