import { supabase } from '../lib/supabaseClient'

// Relojes biometricos que mandan los fichajes solos por WiFi, los fichajes
// que quedaron en espera y el diario del equipo. Todo es del supervisor: las
// politicas de 0025 no dejan que lo vea nadie mas.

export async function listClockDevices() {
  const { data, error } = await supabase.from('clock_devices').select('*').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createClockDevice({ serialNumber, name }, actorId) {
  const { data, error } = await supabase
    .from('clock_devices')
    .insert({ serial_number: serialNumber, name, created_by: actorId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClockDevice(id, changes) {
  const { data, error } = await supabase.from('clock_devices').update(changes).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function listPendingPunches(limit = 100) {
  const { data, error } = await supabase
    .from('clock_pending_punches')
    .select('*')
    .order('punched_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Vuelve a intentar con todo lo que quedo en espera. Sirve despues de cargar
// un N° de reloj o de reabrir una semana.
export async function reprocessClockPunches() {
  const { data, error } = await supabase.rpc('reprocess_clock_punches')
  if (error) throw error
  return data ?? 0
}

export async function listClockDeviceEvents(limit = 20) {
  const { data, error } = await supabase
    .from('clock_device_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export function describeClockDeviceError(error) {
  const message = error?.message ?? ''
  if (message.includes('clock_devices_serial_number_key')) return 'Ese número de serie ya está cargado.'
  return message || 'No se pudo guardar el reloj.'
}
