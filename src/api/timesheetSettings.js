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
