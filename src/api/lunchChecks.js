import { supabase } from '../lib/supabaseClient'

// Almuerzo de cada dia marcado por el propio empleado con el check de su
// pantalla de fichaje (timesheet_lunch_checks). Es lo que vale cuando la salida
// se ficha en el reloj; lo que marca el supervisor y lo que trae la salida de
// la app le ganan. Ver resolveLunch en computeTimesheet.js.

// fromKey/toKey: 'AAAA-MM-DD', ambos inclusive. employeeId opcional: el
// tecnico y el administrativo solo pueden leer lo suyo igual (RLS).
export async function listLunchChecksInRange(fromKey, toKey, employeeId = null) {
  let query = supabase.from('timesheet_lunch_checks').select('*').gte('work_date', fromKey).lte('work_date', toKey)
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('work_date')
  if (error) throw error
  return data
}

// Solo el dia de hoy y con la semana abierta: lo demas la base lo rechaza.
// Quien y cuando lo marco lo pone la base.
export async function saveLunchCheck({ employeeId, workDate, lunchTaken }) {
  const { error } = await supabase
    .from('timesheet_lunch_checks')
    .upsert({ employee_id: employeeId, work_date: workDate, lunch_taken: lunchTaken }, { onConflict: 'employee_id,work_date' })
  if (error) throw error
}
