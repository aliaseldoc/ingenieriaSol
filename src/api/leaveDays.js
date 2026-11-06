import { supabase } from '../lib/supabaseClient'

// Dias de estudio o medico (timesheet_leave_days, ver 0036): pagan la jornada
// de ese dia. El tecnico y el administrativo marcan solo el de hoy; el
// supervisor, cualquier dia de lunes a viernes de una semana abierta. Lo demas
// la base lo rechaza con un mensaje para mostrar. Ver paidLeaveMinutesFor en
// computeTimesheet.js.

// fromKey/toKey: 'AAAA-MM-DD', ambos inclusive. employeeId opcional: el
// tecnico y el administrativo solo pueden leer lo suyo igual (RLS).
export async function listLeaveDaysInRange(fromKey, toKey, employeeId = null) {
  let query = supabase.from('timesheet_leave_days').select('*').gte('work_date', fromKey).lte('work_date', toKey)
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query.order('work_date')
  if (error) throw error
  return data
}

// kind: 'estudio' | 'medico'. Quien, cuando y si fue el supervisor lo pone la base.
export async function saveLeaveDay({ employeeId, workDate, kind }) {
  const { error } = await supabase
    .from('timesheet_leave_days')
    .upsert({ employee_id: employeeId, work_date: workDate, kind }, { onConflict: 'employee_id,work_date' })
  if (error) throw error
}

export async function removeLeaveDay({ employeeId, workDate }) {
  const { error } = await supabase.from('timesheet_leave_days').delete().eq('employee_id', employeeId).eq('work_date', workDate)
  if (error) throw error
}
