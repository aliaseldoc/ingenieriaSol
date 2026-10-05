// Edge Function: envia por mail el aviso de una visita programada o el resumen
// de resultados de una visita ya aprobada. Solo administrativo o supervisor
// pueden invocarla. La clave del proveedor de mail nunca viaja al cliente.
//
// El envio va directo a Brevo. Antes pasaba por EmailJS, que resulto ser mal
// lugar para esto: su plan gratuito esta pensado para mandar desde el
// navegador, no desde un servidor, y la cuenta termino suspendida. Brevo
// acepta el envio desde un servidor y ademas el HTML del mail pasa a estar en
// el codigo (ver plantillas.ts), no en el panel de un tercero.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/brevo.ts'
import {
  escapeHtml,
  notificacionHtml,
  notificacionSubject,
  resultadosHtml,
  resultadosSubject,
} from '../_shared/plantillas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const ALLOWED_ROLES = ['administrativo', 'supervisor']

// Ocurrencia mensual del preventivo: el mismo texto que muestra el panel
// (VISIT_OCCURRENCE_LABELS en src/lib/constants.js).
const VISIT_OCCURRENCE_LABELS = {
  primera: 'Primera Visita',
  segunda: 'Segunda Visita',
}

// El combustible se guarda en dos filas (litros y porcentaje: el tecnico carga
// una y la otra se calcula sola). Se informa la unidad que eligio el tecnico,
// igual que ParametersTable en el panel.
const FUEL_KEY_BY_UNIT = {
  litros: 'combustible_litros',
  porcentaje: 'nivel_combustible',
}

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

// Regla de los datos (ver plantillas.ts): los campos terminados en _html se
// arman aca, asi que el texto libre que escribio una persona (nombre, notas,
// motor) se escapa en este archivo. El resto son datos planos y los escapa la
// plantilla. Escapar dos veces se ve feo ("MERCEDES &amp; BENZ"), no escapar
// es un agujero.

// Estilos en linea para los fragmentos: los clientes de correo no aplican
// hojas de estilo, y lo que se hereda del <td> contenedor no es confiable en
// Outlook. Los valores coinciden con los de plantillas.ts.
const TEXT_STYLE = 'margin:0 0 10px 0;font-size:14px;line-height:21px;color:#12181a;'
const LIST_STYLE = 'margin:0 0 10px 0;padding-left:20px;font-size:14px;line-height:21px;color:#12181a;'
const LABEL_STYLE = 'color:#1f4a3d;'
// Los estilos de arriba coinciden con los de plantillas.ts: los fragmentos que
// se arman aca se insertan adentro de ese HTML y tienen que verse igual.

// "Mantenimiento Preventivo (Primera Visita)". La ocurrencia solo aplica al
// preventivo y puede no estar cargada, en cuyo caso el texto queda como antes.
function serviceTypeLabel(serviceType, visitOccurrence) {
  const base = SERVICE_TYPE_LABELS[serviceType] ?? serviceType
  const ocurrencia = VISIT_OCCURRENCE_LABELS[visitOccurrence]
  if (serviceType !== 'preventivo' || !ocurrencia) return base
  return `${base} (${ocurrencia})`
}

function findParameter(parameters, metricKey) {
  return (parameters ?? []).find((parameter) => parameter.metric_key === metricKey)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendNotificationEmails(callerClient, routeSheetId) {
  const { data: routeSheet, error } = await callerClient
    .from('route_sheets')
    .select(
      'notification_sent_count, scheduled_date, service_type, visit_occurrence, descripcion, visits(equipment(motor, generador, clients(id, name, contact_email)))'
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
    // Espaciado corto entre mails de una misma hoja de ruta: Brevo acepta
    // varios por segundo, pero no hay apuro y evita rozar cualquier limite.
    if (!isFirst) await sleep(300)
    isFirst = false

    const equipmentListHtml = `<ul style="${LIST_STYLE}">${client.equipmentLabels
      .map((label) => `<li style="margin-bottom:4px;">${escapeHtml(label)}</li>`)
      .join('')}</ul>`
    const descripcionBlockHtml = routeSheet.descripcion?.trim()
      ? `<p style="${TEXT_STYLE}"><strong style="${LABEL_STYLE}">Detalle:</strong> ${escapeHtml(routeSheet.descripcion)}</p>`
      : ''
    const datos = {
      scheduled_date: formatDate(routeSheet.scheduled_date),
      service_type_label: serviceTypeLabel(routeSheet.service_type, routeSheet.visit_occurrence),
      equipment_list_html: equipmentListHtml,
      descripcion_block_html: descripcionBlockHtml,
    }
    await sendEmail({
      to: client.contact_email,
      subject: notificacionSubject(datos),
      html: notificacionHtml(datos),
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
      `status, service_type, fault_reported, fault_description, scheduled_date, checklist_data,
       equipment(motor, generador, clients(name, contact_email)),
       route_sheets(visit_occurrence, route_sheet_technicians(profiles(full_name)))`
    )
    .eq('id', visitId)
    .single()
  if (error || !visit) throw new Error('No se encontró la visita.')
  if (visit.status !== 'aprobada') throw new Error('Esta visita todavía no fue aprobada.')

  const client = visit.equipment?.clients
  if (!client?.contact_email) throw new Error('El cliente de esta visita no tiene email de contacto cargado.')

  const { data: parameters } = await callerClient.from('visit_parameters').select('*').eq('visit_id', visitId)

  // Horas de uso y combustible se informan siempre, esten o no fuera de rango:
  // son las dos lecturas que el cliente mira para saber como quedo el equipo.
  // El combustible se guarda en dos filas y se informa la unidad que eligio el
  // tecnico, igual que ParametersTable en el panel.
  const fuelUnit = visit.checklist_data?.combustible_unidad ?? 'porcentaje'
  const lecturas = [
    ['Horas de operación', findParameter(parameters, 'horas_operacion')],
    ['Combustible', findParameter(parameters, FUEL_KEY_BY_UNIT[fuelUnit]) ?? findParameter(parameters, 'nivel_combustible')],
  ].filter(([, parameter]) => parameter?.value != null)

  // El informe al cliente no lista los parametros fuera de rango: solo avisa
  // cuando estuvo todo bien. Si hubo alguno afuera no se dice nada, porque
  // tampoco se puede afirmar lo contrario.
  const hayFueraDeRango = (parameters ?? []).some(
    (parameter) =>
      (parameter.spec_min != null && parameter.value < parameter.spec_min) ||
      (parameter.spec_max != null && parameter.value > parameter.spec_max)
  )

  const technicians = (visit.route_sheets?.route_sheet_technicians ?? []).map((rst) => rst.profiles?.full_name).filter(Boolean)

  const parametersBlockHtml = hayFueraDeRango
    ? ''
    : `<p style="${TEXT_STYLE}">Todos los parámetros medidos estuvieron dentro de rango.</p>`

  const lecturasBlockHtml = lecturas.length
    ? `<p style="${TEXT_STYLE}"><strong style="${LABEL_STYLE}">Lecturas del equipo:</strong></p><ul style="${LIST_STYLE}">${lecturas
        .map(
          ([label, parameter]) =>
            `<li style="margin-bottom:4px;">${label}: <strong>${escapeHtml(parameter.value)} ${escapeHtml(
              parameter.unit ?? ''
            )}</strong></li>`
        )
        .join('')}</ul>`
    : ''

  const datos = {
    // Sin escapar: la plantilla escapa los datos planos.
    equipment_label: [visit.equipment?.motor, visit.equipment?.generador].filter(Boolean).join(' / '),
    scheduled_date: formatDate(visit.scheduled_date),
    service_type_label: serviceTypeLabel(visit.service_type, visit.route_sheets?.visit_occurrence),
    technicians_block_html: technicians.length
      ? `<p style="${TEXT_STYLE}"><strong style="${LABEL_STYLE}">Técnico(s):</strong> ${escapeHtml(technicians.join(', '))}</p>`
      : '',
    parameters_block_html: parametersBlockHtml,
    lecturas_block_html: lecturasBlockHtml,
    // Recuadro rojo tenue en vez de solo texto rojo: en un mail la falla es
    // lo que el cliente tiene que ver primero.
    fault_block_html: visit.fault_reported
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px 0;background-color:#f6dad8;border-left:4px solid #9c2f2b;border-radius:4px;"><tr><td style="padding:12px 14px;font-size:14px;line-height:21px;color:#6b1512;"><strong>Falla reportada por el técnico:</strong> ${escapeHtml(
          visit.fault_description ?? ''
        )}</td></tr></table>`
      : '',
  }

  await sendEmail({
    to: client.contact_email,
    subject: resultadosSubject(datos),
    html: resultadosHtml(datos),
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

  // Una cuenta desactivada o eliminada todavia puede leer su propio perfil
  // (asi la app le explica por que no entra), asi que el rol solo no alcanza.
  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role, active, deleted_at')
    .eq('id', user.id)
    .single()
  if (!ALLOWED_ROLES.includes(callerProfile?.role) || !callerProfile.active || callerProfile.deleted_at) {
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
