import { supabase } from '../lib/supabaseClient'

// Legajos de fichaje. Los del personal con usuario los crea y sincroniza la
// base (triggers de 0021_fichaje.sql); aca solo se cargan los empleados de
// fabrica y el N° en el reloj de cada uno.
export async function listEmployees() {
  const { data, error } = await supabase.from('employees').select('*, profiles(role, username)').order('full_name')
  if (error) throw error
  return data
}

export async function getEmployeeByProfileId(profileId) {
  const { data, error } = await supabase.from('employees').select('*').eq('profile_id', profileId).maybeSingle()
  if (error) throw error
  return data
}

export async function createEmployee({ fullName, dni, clockPin, phone }) {
  const { data, error } = await supabase
    .from('employees')
    .insert({ full_name: fullName, dni: dni || null, clock_pin: clockPin || null, phone: phone || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEmployee(employeeId, changes) {
  const { data, error } = await supabase.from('employees').update(changes).eq('id', employeeId).select().single()
  if (error) throw error
  return data
}

export async function setEmployeeActive(employeeId, active) {
  const { error } = await supabase.from('employees').update({ active }).eq('id', employeeId)
  if (error) throw error
}

export async function isClockPinTaken(clockPin, exceptEmployeeId = null) {
  let query = supabase.from('employees').select('id').eq('clock_pin', clockPin)
  if (exceptEmployeeId) query = query.neq('id', exceptEmployeeId)
  const { data, error } = await query
  if (error) throw error
  return data.length > 0
}

export async function setClockPinForProfile(profileId, clockPin) {
  const { error } = await supabase.from('employees').update({ clock_pin: clockPin || null }).eq('profile_id', profileId)
  if (error) throw error
}

// create-staff no devuelve el id del perfil nuevo: se busca por usuario.
export async function setClockPinForUsername(username, clockPin) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .single()
  if (error) throw error
  await setClockPinForProfile(profile.id, clockPin)
}

// Mensaje claro para el error mas comun: el N° del reloj repetido.
export function describeEmployeeError(error, fallback) {
  if (error?.code === '23505') return 'Ya existe un empleado con ese N° en el reloj.'
  return error?.message || fallback
}
