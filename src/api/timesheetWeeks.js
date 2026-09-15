import { supabase } from '../lib/supabaseClient'

// Sin fila = semana abierta (nunca se cerro).
export async function getTimesheetWeek(weekStart) {
  const { data, error } = await supabase.from('timesheet_weeks').select('*').eq('week_start', weekStart).maybeSingle()
  if (error) throw error
  return data
}

export async function listTimesheetWeeks(weekStarts) {
  if (weekStarts.length === 0) return []
  const { data, error } = await supabase.from('timesheet_weeks').select('*').in('week_start', weekStarts)
  if (error) throw error
  return data
}

export async function listWeekEvents(weekStart) {
  const { data, error } = await supabase
    .from('timesheet_week_events')
    .select('*, profiles(full_name)')
    .eq('week_start', weekStart)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Ambas son funciones de la base (0021_fichaje.sql): cambian el estado y
// dejan el registro en el historial en una sola operacion.
export async function closeTimesheetWeek(weekStart, snapshot) {
  const { error } = await supabase.rpc('close_timesheet_week', { p_week_start: weekStart, p_snapshot: snapshot })
  if (error) throw error
}

export async function reopenTimesheetWeek(weekStart, reason) {
  const { error } = await supabase.rpc('reopen_timesheet_week', { p_week_start: weekStart, p_reason: reason })
  if (error) throw error
}
