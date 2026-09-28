// Punto de entrada del reloj de huella con WiFi.
//
// El equipo manda sus fichajes solo, apenas ocurren, contra /iclock/*. Este
// archivo no decide nada del negocio: traduce el protocolo (ver
// _reloj/protocolo.js) y se lo pasa a la base, que valida el equipo, descarta
// repetidos y deja en espera lo que todavia no puede guardar.
//
// Regla de oro: solo se contesta "OK" cuando los fichajes quedaron guardados.
// Si se contesta bien sin haber guardado, el reloj los borra de su memoria y
// se pierden.

import { ACCION, interpretarPedido, parsearFichajes, respuestaSaludo } from './_reloj/protocolo.js'

const TEXTO_PLANO = 'text/plain; charset=utf-8'

async function llamarBase(funcion, parametros) {
  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor')

  const respuesta = await fetch(`${url}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: clave,
      Authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify(parametros),
  })

  if (!respuesta.ok) {
    throw new Error(`${funcion} respondio ${respuesta.status}: ${await respuesta.text()}`)
  }
  return respuesta.json()
}

async function leerCuerpo(pedido) {
  if (typeof pedido.body === 'string') return pedido.body
  if (Buffer.isBuffer(pedido.body)) return pedido.body.toString('utf8')

  const partes = []
  for await (const parte of pedido) partes.push(parte)
  return Buffer.concat(partes).toString('utf8')
}

function responder(respuesta, estado, texto) {
  respuesta.statusCode = estado
  respuesta.setHeader('Content-Type', TEXTO_PLANO)
  respuesta.end(texto)
}

export default async function handler(pedido, respuesta) {
  const direccion = new URL(pedido.url, 'http://reloj.local')
  const query = Object.fromEntries(direccion.searchParams)
  const accion = (query.accion ?? '').toLowerCase()
  const serial = (query.SN ?? query.sn ?? '').trim()
  const ip = (pedido.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || null

  if (!serial) return responder(respuesta, 400, 'ERROR: falta el numero de serie')

  const tipo = interpretarPedido({ method: pedido.method, accion, query })

  try {
    // Los pedidos que no traen datos solo sirven para saber que el reloj
    // sigue vivo: se contestan con OK sin tocar nada mas.
    if (tipo === ACCION.COMANDOS || tipo === ACCION.RESPUESTA_COMANDO || tipo === ACCION.OTROS_DATOS) {
      await llamarBase('touch_clock_device', { p_serial: serial, p_kind: 'ping', p_detail: null, p_ip: ip })
      return responder(respuesta, 200, 'OK')
    }

    if (tipo === ACCION.SALUDO) {
      const estado = await llamarBase('touch_clock_device', {
        p_serial: serial,
        p_kind: 'contacto',
        p_detail: { query },
        p_ip: ip,
      })
      // Un equipo que no esta dado de alta (o esta desactivado) no recibe
      // configuracion: contestarle bien seria invitarlo a mandar fichajes que
      // despues vamos a rechazar.
      if (!estado?.conocido || !estado?.activo) {
        return responder(respuesta, 401, 'ERROR: reloj no habilitado')
      }
      return responder(respuesta, 200, respuestaSaludo({ serial, stamp: estado.attlog_stamp }))
    }

    if (tipo === ACCION.FICHAJES) {
      const { filas, invalidas } = parsearFichajes(await leerCuerpo(pedido))
      const resultado = await llamarBase('ingest_clock_punches', {
        p_serial: serial,
        p_rows: filas,
        p_stamp: query.Stamp ?? query.stamp ?? null,
        p_ip: ip,
      })

      if (!resultado?.ok) {
        // El reloj conserva los fichajes y vuelve a intentar: el supervisor
        // todavia esta a tiempo de dar de alta el equipo.
        return responder(respuesta, 401, 'ERROR: reloj no habilitado')
      }

      const guardados = (resultado.nuevos ?? 0) + (resultado.repetidos ?? 0) + (resultado.sin_legajo ?? 0) + (resultado.semana_cerrada ?? 0)
      console.log('[reloj] fichajes', { serial, ...resultado, invalidas: invalidas.length })
      return responder(respuesta, 200, `OK: ${guardados}`)
    }

    return responder(respuesta, 200, 'OK')
  } catch (error) {
    // Ante cualquier falla nuestra, error: asi el reloj no da los fichajes por
    // entregados y los vuelve a mandar.
    console.error('[reloj] fallo atendiendo al equipo', serial, error)
    return responder(respuesta, 500, 'ERROR')
  }
}
