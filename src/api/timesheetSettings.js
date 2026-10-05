import { supabase } from '../lib/supabaseClient'

// Una sola fila (id = true) con la ubicacion y el radio de la fabrica.
export async function getTimesheetSettings() {
  const { data, error } = await supabase.from('timesheet_settings').select('*').eq('id', true).maybeSingle()
  if (error) throw error
  return data
}

export async function saveTimesheetSettings({ factoryName, latitude, longitude, radiusMeters }, actorId) {
  const { data, error } = await supabase
    .from('timesheet_settings')
    .upsert({
      id: true,
      factory_name: factoryName || null,
      factory_latitude: latitude,
      factory_longitude: longitude,
      factory_radius_m: radiusMeters,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// A quien le llega el reporte semanal por mail (el dueño y el contador).
export async function saveReportRecipients(recipients, actorId) {
  const { data, error } = await supabase
    .from('timesheet_settings')
    .update({ report_recipients: recipients, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single()
  if (error) throw error
  return data
}
