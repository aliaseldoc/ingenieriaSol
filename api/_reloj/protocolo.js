// Traductor del protocolo "push" (ADMS) de los relojes ZKTeco.
//
// El reloj con WiFi no espera a que lo consulten: sale el solo a buscar al
// servidor y le habla por HTTP con un formato propio, de texto plano. Estas
// funciones son puras (no conocen Supabase ni el servidor donde corren), asi
// se pueden probar sin tener el equipo delante y se pueden reusar tal cual si
// alguna vez hay que atenderlo desde otro lado, por ejemplo desde una maquina
// dentro de la fabrica si el equipo no soporta HTTPS.
//
// El reloj siempre pega contra /iclock/<accion>: la direccion que se le carga
// es solo el dominio, el resto lo arma el.

export const ACCION = {
  SALUDO: 'saludo',
  FICHAJES: 'fichajes',
  OTROS_DATOS: 'otros_datos',
  COMANDOS: 'comandos',
  RESPUESTA_COMANDO: 'respuesta_comando',
  DESCONOCIDA: 'desconocida',
}

export function interpretarPedido({ method, accion, query }) {
  const verbo = (method ?? 'GET').toUpperCase()
  const tabla = (query.table ?? '').toUpperCase()

  if (accion === 'cdata') {
    if (verbo === 'GET') return ACCION.SALUDO
    return tabla === 'ATTLOG' ? ACCION.FICHAJES : ACCION.OTROS_DATOS
  }
  if (accion === 'getrequest') return ACCION.COMANDOS
  if (accion === 'devicecmd') return ACCION.RESPUESTA_COMANDO
  if (accion === 'ping' || accion === 'registry' || accion === 'querydata') return ACCION.COMANDOS
  return ACCION.DESCONOCIDA
}

// Cada fila del reloj es una linea con columnas separadas por tabulaciones:
//   N° de usuario \t AAAA-MM-DD HH:MM:SS \t estado \t verificacion \t ...
// El estado (entrada/salida) no se usa: ningun reloj lo informa de manera
// confiable y el modulo lo deduce por alternancia (ver computeTimesheet.js).
// Algunos firmwares separan con espacios en vez de tabulaciones.
export function parsearFichajes(cuerpo) {
  const filas = []
  const invalidas = []

  for (const linea of String(cuerpo ?? '').split(/\r?\n/)) {
    if (!linea.trim()) continue
    const conTabulaciones = linea.includes('\t')
    const columnas = conTabulaciones ? linea.split('\t') : linea.trim().split(/\s+/)
    const pin = (columnas[0] ?? '').trim()
    // Sin tabulaciones, la fecha y la hora quedan en dos columnas separadas.
    const momento = conTabulaciones
      ? (columnas[1] ?? '').trim()
      : `${columnas[1] ?? ''} ${columnas[2] ?? ''}`.trim()

    if (!pin || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(momento)) {
      invalidas.push(linea)
      continue
    }
    filas.push({ pin, punched_at: momento.replace('T', ' ') })
  }

  return { filas, invalidas }
}

// Respuesta al saludo inicial: le dice al reloj cada cuanto hablar y desde
// donde seguir mandando. `stamp` es la marca que el mismo equipo dejo la
// ultima vez; sin ella manda todo lo que tenga guardado (los repetidos se
// descartan solos al guardarlos).
export function respuestaSaludo({ serial, stamp }) {
  const marca = stamp && stamp.trim() ? stamp.trim() : '0'
  return [
    `GET OPTION FROM: ${serial}`,
    `Stamp=${marca}`,
    `ATTLOGStamp=${marca}`,
    // OPERLOGStamp es el nombre que usa el protocolo; OpStamp es el alias
    // viejo. Se mandan los dos: los firmwares nuevos leen el primero y los
    // viejos el segundo, y sobra el que no entienden.
    'OPERLOGStamp=0',
    'OpStamp=0',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:00',
    'TransInterval=1',
    'TransFlag=111111111111',
    'Realtime=1',
    'TimeZone=-3',
    'Encrypt=0',
    // Sin version de servidor, los firmwares push 3.x repiten el saludo en
    // vez de pasar a mandar datos.
    'ServerVer=2.4.1',
    'PushProtVer=2.4.1',
  ].join('\n')
}
