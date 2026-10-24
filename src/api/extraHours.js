import { supabase } from '../lib/supabaseClient'

// Horas de mas de quien tiene horas fijas (timesheet_extra_hours, ver 0033).
// Las carga el propio empleado desde su pantalla de fichaje; el reporte las
// suma como normales (computeTimesheet.js).

// fromKey/toKey: 'AAAA-MM-DD', ambos inclusive. employeeId opcional: el
// tecnico solo puede leer lo suyo igual (RLS).
export async function listExtraHoursInRange(fromKey, toKey, employeeId = null) {
  let query = supabase.from('timesheet_extra_hours').select('*').gte('work_date', fromKey).lte('work_date', toKey)
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('work_date')
  if (error) throw error
  return data
}

// 0 minutos = sin horas de mas: nunca se borra, se pisa. Quien y cuando lo
// cargo lo pone la base, que rechaza la semana cerrada y los dias que no
// pasaron todavia.
export async function saveExtraHours({ employeeId, workDate, minutes }) {
  const { error } = await supabase
    .from('timesheet_extra_hours')
    .upsert({ employee_id: employeeId, work_date: workDate, minutes }, { onConflict: 'employee_id,work_date' })
  if (error) throw error
}
