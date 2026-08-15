// Edge Function: envia por mail (via EmailJS) el aviso de una visita programada
// o el resumen de resultados de una visita ya aprobada. Solo administrativo o
// supervisor pueden invocarla. Las claves de EmailJS nunca viajan al cliente.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const EMAILJS_SERVICE_ID = Deno.env.get('EMAILJS_SERVICE_ID')
const EMAILJS_PUBLIC_KEY = Deno.env.get('EMAILJS_PUBLIC_KEY')
const EMAILJS_PRIVATE_KEY = Deno.env.get('EMAILJS_PRIVATE_KEY')
const EMAILJS_TEMPLATE_ID_NOTIFICATION = Deno.env.get('EMAILJS_TEMPLATE_ID_NOTIFICATION')
const EMAILJS_TEMPLATE_ID_RESULTS = Deno.env.get('EMAILJS_TEMPLATE_ID_RESULTS')

const ALLOWED_ROLES = ['administrativo', 'supervisor']

const SERVICE_TYPE_LABELS = {
  preventivo: 'Mantenimiento Preventivo',
  correctivo: 'Reparación Correctiva',
  instalacion: 'Instalación/Puesta en marcha',
  inspeccion: 'Inspección de Rutina',
}

// El navegador siempre manda un preflight OPTIONS antes del POST real;
// sin estos headers en TODAS las respuestas, el fetch del browser falla por CORS.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function formatDate(isoDate) {
  if (!isoDate) return 'sin fecha'
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Las plantillas de EmailJS insertan estos fragmentos con {{{...}}} (sin
// escapar), asi que cualquier texto libre que venga de un usuario (nombre,
// notas, motor) se escapa aca antes de armar el HTML.
function escapeHtml(text) {
  return String(text ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// La API de EmailJS acepta 1 request por segundo; una hoja de ruta con
// varios clientes manda varios mails seguidos, asi que hay que espaciarlos.
async function sendTemplateEmail(templateId, templateParams) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY || !templateId) {
    throw new Error('Falta configurar las credenciales de EmailJS como secrets de la Edge Function.')
  }
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams,
    }),
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`EmailJS rechazó el envío: ${errorBody}`)
  }
}

async function sendNotificationEmails(callerClient, routeSheetId) {
  const { data: routeSheet, error } = await callerClient
    .from('route_sheets')
    .select(
      'notification_sent_count, scheduled_date, service_type, descripcion, visits(equipment(motor, generador, clients(id, name, contact_email)))'
    )
    .eq('id', routeSheetId)
    .single()
  if (error || !routeSheet) throw new Error('No se encontró la hoja de ruta.')

  const clientsById = new Map()
  for (const visit of routeSheet.visits ?? []) {
    const client = visit.equipment?.clients
    if (!client) continue
    const entry = clientsById.get(client.id) ?? { name: client.name, contact_email: client.contact_email, equipmentLabels: [] }
    entry.equipmentLabels.push([visit.equipment.motor, visit.equipment.generador].filter(Boolean).join(' / '))
    clientsById.set(client.id, entry)
  }

  const sentTo = []
  const skipped = []
  let isFirst = true
  for (const client of clientsById.values()) {
    if (!client.contact_email) {
      skipped.push(client.name)
      continue
    }
    if (!isFirst) await sleep(1100)
    isFirst = false

    const equipmentListHtml = `<ul>${client.equipmentLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join('')}</ul>`
    const descripcionBlockHtml = routeSheet.descripcion?.trim()
      ? `<p><strong>Detalle:</strong> ${escapeHtml(routeSheet.descripcion)}</p>`
      : ''
    await sendTemplateEmail(EMAILJS_TEMPLATE_ID_NOTIFICATION, {
      to_email: client.contact_email,
      scheduled_date: formatDate(routeSheet.scheduled_date),
      service_type_label: SERVICE_TYPE_LABELS[routeSheet.service_type] ?? routeSheet.service_type,
      equipment_list_html: equipmentListHtml,
      descripcion_block_html: descripcionBlockHtml,
    })
    sentTo.push(client.contact_email)
  }

  let notificationSentCount = routeSheet.notification_sent_count
  if (sentTo.length > 0) {
    notificationSentCount = (routeSheet.notification_sent_count ?? 0) + 1
    await callerClient.from('route_sheets').update({ notification_sent_count: notificationSentCount }).eq('id', routeSheetId)
  }

  return { ok: true, sentTo, skipped, notificationSentCount }
}

async function sendResultsEmail(callerClient, visitId) {
  const { data: visit, error } = await callerClient
    .from('visits')
    .select(
      `status, service_type, fault_reported, fault_description, notes, scheduled_date,
       equipment(motor, generador, clients(name, contact_email)),
       route_sheets(route_sheet_technicians(profiles(full_name)))`
    )
    .eq('id', visitId)
    .single()
  if (error || !visit) throw new Error('No se encontró la visita.')
  if (visit.status !== 'aprobada') throw new Error('Esta visita todavía no fue aprobada.')

  const client = visit.equipment?.clients
  if (!client?.contact_email) throw new Error('El cliente de esta visita no tiene email de contacto cargado.')

  const { data: parameters } = await callerClient.from('visit_parameters').select('*').eq('visit_id', visitId)
  const outOfRange = (parameters ?? []).filter(
    (parameter) =>
      (parameter.spec_min != null && parameter.value < parameter.spec_min) ||
      (parameter.spec_max != null && parameter.value > parameter.spec_max)
  )

  const technicians = (visit.route_sheets?.route_sheet_technicians ?? []).map((rst) => rst.profiles?.full_name).filter(Boolean)

  const parametersBlockHtml = outOfRange.length
    ? `<p><strong>Parámetros fuera de rango:</strong></p><ul>${outOfRange
        .map((p) => `<li>${escapeHtml(p.metric_label)}: ${escapeHtml(p.value)} ${escapeHtml(p.unit ?? '')}</li>`)
        .join('')}</ul>`
    : '<p>Todos los parámetros medidos estuvieron dentro de rango.</p>'

  await sendTemplateEmail(EMAILJS_TEMPLATE_ID_RESULTS, {
    to_email: client.contact_email,
    equipment_label: escapeHtml([visit.equipment?.motor, visit.equipment?.generador].filter(Boolean).join(' / ')),
    scheduled_date: formatDate(visit.scheduled_date),
    service_type_label: SERVICE_TYPE_LABELS[visit.service_type] ?? visit.service_type,
    technicians_block_html: technicians.length ? `<p><strong>Técnico(s):</strong> ${escapeHtml(technicians.join(', '))}</p>` : '',
    parameters_block_html: parametersBlockHtml,
    fault_block_html: visit.fault_reported
      ? `<p style="color:#9c2f2b"><strong>Falla reportada:</strong> ${escapeHtml(visit.fault_description ?? '')}</p>`
      : '',
    notes_block_html: visit.notes ? `<p><strong>Notas del técnico:</strong> ${escapeHtml(visit.notes)}</p>` : '',
  })

  return { ok: true, sentTo: [client.contact_email] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Falta encabezado de autorizacion' }, 401)
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) {
    return jsonResponse({ error: 'No autenticado' }, 401)
  }

  const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', user.id).single()
  if (!ALLOWED_ROLES.includes(callerProfile?.role)) {
    return jsonResponse({ error: 'No tenés permiso para enviar este mail' }, 403)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud invalido' }, 400)
  }

  try {
    if (body.type === 'notificacion' && body.routeSheetId) {
      const result = await sendNotificationEmails(callerClient, body.routeSheetId)
      return jsonResponse(result, 200)
    }
    if (body.type === 'resultados' && body.visitId) {
      const result = await sendResultsEmail(callerClient, body.visitId)
      return jsonResponse(result, 200)
    }
    return jsonResponse({ error: 'Parámetros inválidos' }, 400)
  } catch (sendError) {
    return jsonResponse({ error: sendError.message ?? 'No se pudo enviar el mail' }, 400)
  }
})
