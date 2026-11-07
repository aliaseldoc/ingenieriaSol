// Documento del reporte semanal de horas. Puro: devuelve la definicion de la
// hoja para write-excel-file, sin importar la libreria. Lo usan la pantalla del
// supervisor (boton "Exportar Excel") y la Edge Function que manda el reporte
// por mail los lunes, asi el archivo es el mismo en los dos casos. La misma
// Edge Function escribe esta hoja en la planilla de Drive (ver
// supabase/functions/cierre-semanal/planillaHoras.js), con buildWeeklyReportLayout.
//
// Recibe filas con la forma del snapshot de cierre (o del calculo en vivo, que
// es la misma): { employeeId, clockPin, fullName, reportPosition,
// fixedWeeklyMinutes, totals, days[] }. Van en el orden de la liquidacion
// (compareReportRows).
//
// Resumen arriba y detalle por dia abajo, en una sola hoja (pedido del
// 04/11/2026), cada uno con formato de tabla (tableData en xlsxCells.js). El
// resumen lleva "Valor hora", que se completa a mano (en la planilla de Drive
// pasa de una semana a la siguiente), y "Total a pagar", que ya trae la
// formula: normales x valor + al 50% x valor x 1,5 + al 100% x valor x 2.
//
// Con extension explicita en los imports: Deno no adivina el ".js".
import {
  MONEY_FORMAT,
  dateCell,
  durationCell,
  formulaCell,
  moneyCell,
  numberCell,
  tableColumns,
  tableData,
  tableTitleCell,
  textCell,
} from '../../lib/xlsxCells.js'
import { DAY_STATUS, DAY_TYPE, dayTypeLabel, skippedLunch } from './computeTimesheet.js'
import { compareReportRows } from './reportEmployees.js'

// Horarios de un dia para el detalle (Excel y pantalla de Reporte): un tramo
// por posicion, "07:50 / 13:00" con "12:00 / 18:00". La salida del dia
// siguiente lleva "(+1)"; lo que falta en un dia incompleto dice "falta" y la
// jornada todavia abierta, "en curso". Las fotos de semanas cerradas antes de
// que se guardaran los horarios no los traen: quedan en blanco.
export function formatDayTimes(day) {
  const tramos = day.tramos ?? []
  const salida = (tramo) => {
    if (tramo.salida) return tramo.salidaDiaSiguiente ? `${tramo.salida} (+1)` : tramo.salida
    return tramo.enCurso ? 'en curso' : 'falta'
  }
  return {
    entradas: tramos.map((tramo) => tramo.entrada ?? 'falta').join(' / '),
    salidas: tramos.map(salida).join(' / '),
  }
}

// Si almorzo, para el detalle (Excel y pantalla de Reporte; pedido del
// 07/11/2026): "No" el dia habil trabajado en que no freno, "Sí" el que
// almorzo. Queda en blanco el fin de semana, el feriado, el dia sin trabajo y
// las fotos de semanas cerradas antes de que se guardara el dato.
export function lunchLabel(day) {
  if (skippedLunch(day)) return 'No'
  if (day.dayType === DAY_TYPE.HABIL && day.lunchTaken === true && day.workedMinutes > 0) return 'Sí'
  return ''
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function weekdayName(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

export const HOURLY_RATE_HEADER = 'Valor hora'

// Columnas del resumen. Las letras de la formula de "Total a pagar" salen de
// estas posiciones: C normales, D al 50%, E al 100%, H valor hora.
const SUMMARY_COLUMNS = [
  { header: 'Legajo', width: 10 },
  { header: 'Empleado', width: 32 },
  { header: 'Horas normales', width: 15 },
  { header: 'Horas al 50%', width: 14 },
  { header: 'Horas al 100%', width: 14 },
  { header: 'Total', width: 11 },
  { header: 'Días incompletos', width: 16 },
  { header: HOURLY_RATE_HEADER, width: 14 },
  { header: 'Total a pagar', width: 18 },
]

const DETAIL_COLUMNS = [
  { header: 'Legajo', width: 10 },
  { header: 'Empleado', width: 32 },
  { header: 'Fecha', width: 12 },
  { header: 'Día', width: 11 },
  { header: 'Tipo de día', width: 13 },
  { header: 'Entrada', width: 16 },
  { header: 'Salida', width: 19 },
  { header: 'Almorzó', width: 10 },
  { header: 'Normales', width: 11 },
  { header: 'Al 50%', width: 10 },
  { header: 'Al 100%', width: 10 },
  { header: 'Total', width: 10 },
]

const DETAIL_TITLE = 'Detalle por día'
// Filas vacias entre el resumen y el titulo del detalle.
const GAP_ROWS = 2

// Total a pagar de la fila `excelRow` (1 = primera fila de la hoja). El x 1,5
// va como x 3/2: la planilla de Google en castellano no entiende "1.5" (ni
// Excel "1,5"), y asi la formula es la misma en los dos.
function totalToPayFormula(excelRow) {
  const hours = (column) => `${column}${excelRow}*24`
  const rate = `H${excelRow}`
  return `=${hours('C')}*${rate}+${hours('D')}*${rate}*3/2+${hours('E')}*${rate}*2`
}

// Una fila por dia, con los horarios de entrada y salida. Los dias sin
// fichajes se omiten (solo agregarian ruido), salvo el feriado pago y el dia
// de estudio o medico, que pagan horas.
function dayDetailRows(row) {
  return row.days
    .filter((day) => day.status !== DAY_STATUS.SIN_FICHAJES || day.paidHolidayMinutes > 0 || day.paidLeaveMinutes > 0)
    .map((day) => {
      const { entradas, salidas } = formatDayTimes(day)
      return [
        textCell(row.clockPin),
        textCell(row.fullName),
        dateCell(day.dateKey),
        textCell(weekdayName(day.dateKey)),
        textCell(dayTypeLabel(day)),
        textCell(entradas),
        textCell(salidas),
        textCell(lunchLabel(day)),
        durationCell(day.normalMinutes),
        durationCell(day.extra50Minutes),
        durationCell(day.extra100Minutes),
        durationCell(day.totalMinutes),
      ]
    })
}

// La hoja, armada una sola vez para el Excel y para la planilla de Drive:
//   summary: { startRow, headers, rows: [{ key, cells }] } (key = employeeId)
//   detailTitle: { row, text }
//   detail: { startRow, headers, rows: [cells] }
//   widths: ancho de cada columna (en caracteres de la letra de 11), el mayor
//     de las dos tablas
//   hourlyRateColumn: indice de "Valor hora"
// Las filas son indices desde 0; la formula usa los numeros de fila de la hoja.
// hourlyRates: Map employeeId -> valor hora (lo que ya se cargo en Drive).
export function buildWeeklyReportLayout(rows, hourlyRates = new Map()) {
  const ordered = [...rows].sort(compareReportRows)
  const summaryRows = ordered.map((row, index) => ({
    key: row.employeeId,
    cells: [
      textCell(row.clockPin),
      textCell(row.fullName),
      durationCell(row.totals.normalMinutes),
      durationCell(row.totals.extra50Minutes),
      durationCell(row.totals.extra100Minutes),
      durationCell(row.totals.totalMinutes),
      numberCell(row.totals.incompleteDays),
      moneyCell(hourlyRates.get(row.employeeId)),
      // Fila 1 = encabezado: la primera persona esta en la fila 2.
      formulaCell(totalToPayFormula(index + 2), MONEY_FORMAT),
    ],
  }))
  const detailTitleRow = 1 + summaryRows.length + GAP_ROWS
  return {
    summary: { startRow: 0, headers: SUMMARY_COLUMNS.map((column) => column.header), rows: summaryRows },
    detailTitle: { row: detailTitleRow, text: DETAIL_TITLE },
    detail: { startRow: detailTitleRow + 1, headers: DETAIL_COLUMNS.map((column) => column.header), rows: ordered.flatMap(dayDetailRows) },
    widths: DETAIL_COLUMNS.map((column, index) => Math.max(column.width, SUMMARY_COLUMNS[index]?.width ?? 0)),
    hourlyRateColumn: SUMMARY_COLUMNS.findIndex((column) => column.header === HOURLY_RATE_HEADER),
  }
}

export function weeklyReportFileName(weekStartKey) {
  return `fichajes-semana-${weekStartKey}.xlsx`
}

export function buildWeeklyReportSheets(rows) {
  const layout = buildWeeklyReportLayout(rows)
  const gap = Array.from({ length: GAP_ROWS }, () => [null])
  return [
    {
      sheet: 'Reporte',
      data: [
        ...tableData(layout.summary.headers, layout.summary.rows.map((row) => row.cells)),
        ...gap,
        [tableTitleCell(layout.detailTitle.text)],
        ...tableData(layout.detail.headers, layout.detail.rows),
      ],
      // Sin filas fijas: al bajar al detalle, el encabezado del resumen confundiria.
      columns: tableColumns(layout.widths),
    },
  ]
}
