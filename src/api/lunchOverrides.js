import { supabase } from '../lib/supabaseClient'

// Almuerzo de cada dia marcado por el supervisor (timesheet_lunch_overrides).
// Gana a lo que declaro el empleado al registrar la salida; ver
// computeTimesheet.js.

// fromKey/toKey: 'AAAA-MM-DD', ambos inclusive. employeeId opcional: el
// tecnico y el administrativo solo pueden leer lo suyo igual (RLS).
export async function listLunchOverridesInRange(fromKey, toKey, employeeId = null) {
  let query = supabase.from('timesheet_lunch_overrides').select('*').gte('work_date', fromKey).lte('work_date', toKey)
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('work_date')
  if (error) throw error
  return data
}

// Quien y cuando lo marco lo pone la base. Con la semana cerrada la base lo
// rechaza.
export async function setLunchOverride({ employeeId, workDate, lunchTaken }) {
  const { error } = await supabase
    .from('timesheet_lunch_overrides')
    .upsert({ employee_id: employeeId, work_date: workDate, lunch_taken: lunchTaken }, { onConflict: 'employee_id,work_date' })
  if (error) throw error
}
