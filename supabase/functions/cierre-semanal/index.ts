// Edge Function: cierre semanal del fichaje y mail del reporte.
//
// Dos acciones, cada una disparada por una tarea programada (pg_cron, ver la
// migracion 0027):
//   - "cerrar": lunes 00:00 (hora argentina). Cierra la semana que termino,
//     con la misma foto del reporte que guarda el supervisor al cerrar a mano.
//   - "enviar": todos los dias a las 09:00. Manda por mail el reporte de cada
//     semana cerrada que todavia no salio (el lunes, la que se acaba de
//     cerrar; otro dia, una que el supervisor reabrio y volvio a cerrar).
// El supervisor tambien puede pedir "enviar" desde la app (boton "Enviar
// reporte ahora"), con su propia sesion.
//
// Las horas se calculan con el MISMO motor que la pantalla (src/features/
// timesheet): si cada lado tuviera su copia, el mail y la app podrian no
// coincidir. Por eso esos modulos llevan extension explicita en sus imports.
//
// Se despliega con --no-verify-jwt: la tarea programada no tiene usuario y se
// identifica con CRON_SECRET. Una persona se valida aca adentro, como en las
// demas funciones.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import writeXlsxFile from 'npm:write-excel-file@4.1.1/universal'
import { sendEmail } from '../_shared/brevo.ts'
import { escapeHtml, reporteSemanalHtml, reporteSemanalSubject } from '../_shared/plantillas.ts'
import { toWeekSnapshot, weekPunchRange } from '../../../src/features/timesheet/computeTimesheet.js'
import { buildWeekReport, compareReportRows } from '../../../src/features/timesheet/reportEmployees.js'
import { addDaysToKey, currentWeekStartKey, formatMinutes, formatWeekRange, isValidWeekStartKey } from '../../../src/features/timesheet/workTime.js'
import { buildWeeklyReportSheets, weeklyReportFileName } from '../../../src/features/timesheet/weeklyReportXlsx.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const CRON_SECRET = Deno.env.get('CRON_SECRET')

const ZONA = 'America/Argentina/Buenos_Aires'
// La tarea de las 09:00 solo manda semanas cerradas hace poco. Sin este tope,
// el dia que se cargan los destinatarios por primera vez saldrian de golpe
// todas las semanas acumuladas. Una vieja se puede mandar con el boton.
const DIAS_PARA_ENVIO_AUTOMATICO = 7
const PAGE_SIZE = 1000

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

// La tarea programada (con el secreto) o un supervisor activo con su sesion.
async function identificar(req) {
  const secreto = req.headers.get('x-cron-secret')
  if (CRON_SECRET && secreto && secreto === CRON_SECRET) return { quien: 'tarea' }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
  } = await callerClient.auth.getUser()
  if (!user) return null
  const { data: profile } = await callerClient
    .from('profiles')
    .select('role, active, deleted_at')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'supervisor' || !profile.active || profile.deleted_at) return null
  return { quien: 'supervisor' }
}

async function fetchAllPages(buildQuery) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

// Las mismas consultas que useTimesheetWeek (listEmployees, listPunchesInRange,
// listHolidaysInRange, listLunchOverridesInRange), con la clave de servicio.
async function calcularSemana(admin, weekStartKey) {
  const { from, to } = weekPunchRange(weekStartKey)
  const [employeesResult, punches, holidaysResult, lunchResult] = await Promise.all([
    admin.from('employees').select('*, profiles(role, username)').order('full_name'),
    fetchAllPages(() =>
      admin.from('time_punches').select('*').gte('punched_at', from).lt('punched_at', to).order('punched_at')
    ),
    admin
      .from('holidays')
      .select('*')
      .gte('date', addDaysToKey(weekStartKey, -1))
      .lte('date', addDaysToKey(weekStartKey, 7))
      .order('date'),
    admin
      .from('timesheet_lunch_overrides')
      .select('*')
      .gte('work_date', weekStartKey)
      .lte('work_date', addDaysToKey(weekStartKey, 6))
      .order('work_date'),
  ])
  if (employeesResult.error) throw employeesResult.error
  if (holidaysResult.error) throw holidaysResult.error
  if (lunchResult.error) throw lunchResult.error
  return buildWeekReport({
    employees: employeesResult.data,
    punches,
    holidays: holidaysResult.data,
    lunchOverrides: lunchResult.data,
    weekStartKey,
  })
}

async function cerrar(admin, weekStartKey) {
  const { data: week, error } = await admin
    .from('timesheet_weeks')
    .select('status')
    .eq('week_start', weekStartKey)
    .maybeSingle()
  if (error) throw error
  if (week?.status === 'cerrada') return { semana: weekStartKey, resultado: 'ya estaba cerrada' }

  // Con dias incompletos se cierra igual: esos dias no suman (asi lo hace el
  // motor) y el mail los señala. El supervisor puede reabrir y corregir.
  const rows = await calcularSemana(admin, weekStartKey)
  const { data: cerro, error: closeError } = await admin.rpc('close_timesheet_week_auto', {
    p_week_start: weekStartKey,
    p_snapshot: toWeekSnapshot(rows, weekStartKey),
  })
  if (closeError) throw closeError
  return { semana: weekStartKey, resultado: cerro ? 'cerrada' : 'ya estaba cerrada' }
}

function formatearCierre(closedAt, closedByName) {
  const cuando = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    // Sin esto Deno escribe "12:00 a. m." en vez de "00:00".
    hourCycle: 'h23',
  }).format(new Date(closedAt))
  return `${cuando} · ${closedByName ? `por ${closedByName}` : 'automático'}`
}

// Estilos en linea, como en send-visit-email: los clientes de correo no
// aplican hojas de estilo.
const TH = 'padding:8px 6px;border-bottom:2px solid #1f4a3d;font-size:12px;line-height:16px;color:#1f4a3d;text-align:right;'
const TD = 'padding:8px 6px;border-bottom:1px solid #e3e5e0;font-size:13px;line-height:18px;color:#12181a;text-align:right;'

// En el orden de la liquidacion del contador, igual que el Excel adjunto.
function tablaHtml(rows) {
  const ordenadas = [...rows].sort(compareReportRows)
  const total = (key) => rows.reduce((sum, row) => sum + (row.totals[key] ?? 0), 0)
  const fila = (row) => `<tr>
    <td style="${TD}text-align:left;">${escapeHtml(row.fullName)}${row.clockPin ? `<br /><span style="font-size:11px;color:#5c6360;">Legajo ${escapeHtml(row.clockPin)}</span>` : ''}</td>
    <td style="${TD}">${formatMinutes(row.totals.normalMinutes)}</td>
    <td style="${TD}">${formatMinutes(row.totals.extra50Minutes)}</td>
    <td style="${TD}">${formatMinutes(row.totals.extra100Minutes)}</td>
    <td style="${TD}font-weight:bold;">${formatMinutes(row.totals.totalMinutes)}</td>
    <td style="${TD}${row.totals.incompleteDays > 0 ? 'color:#9c2f2b;font-weight:bold;' : ''}">${row.totals.incompleteDays}</td>
  </tr>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px 0;border-collapse:collapse;">
  <tr>
    <th style="${TH}text-align:left;">Empleado</th>
    <th style="${TH}">Normales</th>
    <th style="${TH}">Al 50%</th>
    <th style="${TH}">Al 100%</th>
    <th style="${TH}">Total</th>
    <th style="${TH}">Incompl.</th>
  </tr>
  ${ordenadas.map(fila).join('')}
  <tr>
    <td style="${TD}text-align:left;font-weight:bold;border-bottom:0;">Total</td>
    <td style="${TD}font-weight:bold;border-bottom:0;">${formatMinutes(total('normalMinutes'))}</td>
    <td style="${TD}font-weight:bold;border-bottom:0;">${formatMinutes(total('extra50Minutes'))}</td>
    <td style="${TD}font-weight:bold;border-bottom:0;">${formatMinutes(total('extra100Minutes'))}</td>
    <td style="${TD}font-weight:bold;border-bottom:0;">${formatMinutes(total('totalMinutes'))}</td>
    <td style="${TD}font-weight:bold;border-bottom:0;">${total('incompleteDays')}</td>
  </tr>
</table>`
}

// Recuadro ambar, mismo criterio que el de falla en el mail de resultados.
function avisoIncompletosHtml(rows) {
  const dias = rows.reduce((sum, row) => sum + (row.totals.incompleteDays ?? 0), 0)
  if (dias === 0) return ''
  const texto =
    dias === 1
      ? 'Hay 1 día incompleto (falta una entrada o una salida): no suma horas hasta que el supervisor lo corrija y vuelva a cerrar la semana.'
      : `Hay ${dias} días incompletos (falta una entrada o una salida): no suman horas hasta que el supervisor los corrija y vuelva a cerrar la semana.`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px 0;background-color:#fbf0d9;border-left:4px solid #a86b00;border-radius:4px;"><tr><td style="padding:12px 14px;font-size:14px;line-height:21px;color:#5c3b00;">${escapeHtml(texto)}</td></tr></table>`
}

async function enviarSemana(admin, week, recipients) {
  const rows = week.snapshot?.rows ?? []
  let closedByName = null
  if (week.closed_by) {
    const { data } = await admin.from('profiles').select('full_name').eq('id', week.closed_by).maybeSingle()
    closedByName = data?.full_name ?? null
  }

  const datos = {
    // Planos: los escapa la plantilla.
    semana: formatWeekRange(week.week_start),
    cerrada: formatearCierre(week.closed_at, closedByName),
    personas: String(rows.length),
    // Corregido = ya se habia mandado y despues se reabrio la semana.
    corregido: week.report_sent_count > 0 && !week.report_sent_at,
    // Ya armados (y escapados) aca.
    tabla_html: rows.length > 0 ? tablaHtml(rows) : '<p style="margin:0 0 10px 0;">Nadie fichó esta semana.</p>',
    aviso_html: avisoIncompletosHtml(rows),
  }

  const blob = await writeXlsxFile(buildWeeklyReportSheets(rows)).toBlob()
  const excel = encodeBase64(new Uint8Array(await blob.arrayBuffer()))

  await sendEmail({
    to: recipients,
    subject: reporteSemanalSubject(datos),
    html: reporteSemanalHtml(datos),
    attachments: [{ name: weeklyReportFileName(week.week_start), contentBase64: excel }],
  })

  const { error } = await admin.rpc('mark_week_report_sent', { p_week_start: week.week_start })
  if (error) throw error
  return { semana: week.week_start, resultado: 'enviada', corregido: datos.corregido }
}

async function enviar(admin, weekStartKey) {
  const { data: settings, error: settingsError } = await admin
    .from('timesheet_settings')
    .select('report_recipients')
    .single()
  if (settingsError) throw settingsError
  const recipients = (settings?.report_recipients ?? []).filter(Boolean)
  if (recipients.length === 0) return [{ resultado: 'sin destinatarios cargados: no se mandó nada' }]

  let query = admin.from('timesheet_weeks').select('*').eq('status', 'cerrada').order('week_start')
  if (weekStartKey) {
    query = query.eq('week_start', weekStartKey)
  } else {
    const desde = new Date(Date.now() - DIAS_PARA_ENVIO_AUTOMATICO * 24 * 60 * 60 * 1000).toISOString()
    query = query.is('report_sent_at', null).gte('closed_at', desde)
  }
  const { data: weeks, error } = await query
  if (error) throw error
  if (weekStartKey && weeks.length === 0) throw new Error('Esa semana no está cerrada: cerrala antes de mandar el reporte.')

  const resultados = []
  for (const week of weeks) {
    resultados.push(await enviarSemana(admin, week, recipients))
  }
  return resultados
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido' }, 405)
  }

  const llamador = await identificar(req)
  if (!llamador) {
    return jsonResponse({ error: 'No autorizado' }, 401)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud invalido' }, 400)
  }

  const weekStart = body.weekStart ?? null
  if (weekStart && !isValidWeekStartKey(weekStart)) {
    return jsonResponse({ error: 'La semana tiene que empezar un lunes (AAAA-MM-DD).' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  try {
    if (body.accion === 'cerrar') {
      // Cerrar sin que nadie lo vea lo hace solo la tarea programada; el
      // supervisor ya tiene su boton de cierre en la app.
      if (llamador.quien !== 'tarea') return jsonResponse({ error: 'No autorizado' }, 403)
      // Por defecto, la semana que termino: lunes 00:00 ya es la semana nueva.
      const target = weekStart ?? addDaysToKey(currentWeekStartKey(Date.now()), -7)
      return jsonResponse({ ok: true, ...(await cerrar(admin, target)) }, 200)
    }
    if (body.accion === 'enviar') {
      return jsonResponse({ ok: true, envios: await enviar(admin, weekStart) }, 200)
    }
    return jsonResponse({ error: 'Acción inválida' }, 400)
  } catch (error) {
    console.error('[cierre-semanal]', error)
    return jsonResponse({ error: error.message ?? 'No se pudo completar la acción' }, 500)
  }
})
