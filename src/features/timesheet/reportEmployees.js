// Quien entra en el reporte de una semana y el calculo de sus horas. Es puro
// (sin React ni Supabase) porque lo usan dos lados: la pantalla del supervisor
// (useTimesheetWeek) y la Edge Function que cierra la semana sola los lunes.
// Si cada uno armara la lista a su manera, el reporte del mail y el de la
// pantalla podrian no coincidir.
//
// Con extension explicita en los imports: Deno no adivina el ".js".
import { ROLES } from '../../lib/constants.js'
import { computeWeekReport } from './computeTimesheet.js'
import { toDateKey, weekDayKeys } from './workTime.js'

// Personal que ficha: con N° en el reloj, o tecnico o administrativo (los dos
// fichan por la app). Un supervisor que no usa el reloj no aparece en el
// reporte: si no, el feriado pago le sumaria 9 h sin haber fichado nunca.
const ROLES_QUE_FICHAN = new Set([ROLES.TECNICO, ROLES.ADMINISTRATIVO])

export function clocksIn(employee) {
  return Boolean(employee.clock_pin) || ROLES_QUE_FICHAN.has(employee.profiles?.role)
}

// Entra el personal activo que ficha y cualquiera (incluso inactivo) que
// tenga fichajes esa semana: alguien dado de baja a mitad de semana igual
// tiene que cobrar lo que trabajo. Quien tiene horas fijas no ficha: entra
// mientras su legajo este activo.
export function selectReportEmployees({ employees, punches, weekStartKey }) {
  const dayKeys = new Set(weekDayKeys(weekStartKey))
  const employeesWithPunches = new Set(
    punches
      .filter((punch) => !punch.voided_at && dayKeys.has(toDateKey(new Date(punch.punched_at).getTime())))
      .map((punch) => punch.employee_id)
  )
  return employees.filter((employee) => {
    if (employee.fixed_weekly_minutes) return employee.active
    return (employee.active && clocksIn(employee)) || employeesWithPunches.has(employee.id)
  })
}

// Orden del reporte (mail, Excel y pantalla): el de la liquidacion del
// contador (employees.report_position). Quien no tiene lugar va al final, por
// nombre; las fotos de semanas cerradas antes de que existiera el lugar salen
// por nombre, como siempre.
export function compareReportRows(a, b) {
  const positionA = a.reportPosition ?? Number.MAX_SAFE_INTEGER
  const positionB = b.reportPosition ?? Number.MAX_SAFE_INTEGER
  if (positionA !== positionB) return positionA - positionB
  return a.fullName.localeCompare(b.fullName, 'es')
}

// lunchOverrides: filas de timesheet_lunch_overrides (lo que marco el
// supervisor sobre el almuerzo de cada dia). extraHours: filas de
// timesheet_extra_hours (las horas de mas de quien tiene horas fijas).
export function buildWeekReport({ employees, punches, holidays, lunchOverrides = [], extraHours = [], weekStartKey, now = Date.now() }) {
  return computeWeekReport({
    employees: selectReportEmployees({ employees, punches, weekStartKey }),
    punches,
    weekStartKey,
    holidayKeys: holidays.map((holiday) => holiday.date),
    lunchOverrides,
    extraHours,
    now,
  })
}
