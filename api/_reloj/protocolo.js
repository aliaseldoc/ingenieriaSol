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
  ALTA: 'alta',
  FICHAJES: 'fichajes',
  FICHAJES_TIEMPO_REAL: 'fichajes_tiempo_real',
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
    // Los relojes de asistencia mandan ATTLOG; los de control de acceso
    // (DeviceType=acc, como el F22) mandan RTLOG, con otro formato.
    if (tabla === 'ATTLOG') return ACCION.FICHAJES
    if (tabla === 'RTLOG') return ACCION.FICHAJES_TIEMPO_REAL
    return ACCION.OTROS_DATOS
  }
  // El equipo se da de alta antes de mandar nada: espera un RegistryCode y,
  // si no lo recibe, repite el ciclo sin llegar nunca a los fichajes.
  if (accion === 'registry') return ACCION.ALTA
  if (accion === 'getrequest') return ACCION.COMANDOS
  if (accion === 'devicecmd') return ACCION.RESPUESTA_COMANDO
  if (accion === 'ping' || accion === 'push' || accion === 'querydata') return ACCION.COMANDOS
  return ACCION.DESCONOCIDA
}

// Tablas que el equipo manda para sincronizarse (su configuracion, su lista de
// usuarios, el estado de la puerta). No son fichajes y no hay que guardarlas,
// pero tampoco son una señal de que algo ande mal: se contestan OK sin anotar,
// para no llenar el diario.
const TABLAS_CONOCIDAS = new Set(['OPTIONS', 'RTSTATE', 'TABLEDATA', 'OPERLOG', 'ATTPHOTO', 'BIODATA'])

export function esTablaConocida(tabla) {
  return TABLAS_CONOCIDAS.has(String(tabla ?? '').toUpperCase())
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

// Los equipos de control de acceso mandan cada evento apenas pasa, en una
// linea de pares clave=valor separados por tabulaciones:
//   time=2026-10-03 14:10:32\tpin=9999\tcardno=0\tevent=3\tverifytype=1\t...
//
// En el mismo lote vienen mezcladas lineas de estado de la puerta
// (time=...\tsensor=01\trelay=00\tdoor=01), que no tienen pin.
//
// Se toma como fichaje toda linea con hora valida y un pin distinto de 0. No
// se filtra por `event` a proposito: el unico codigo que vimos para una
// verificacion correcta es el 3, pero la tabla de codigos de ZKTeco varia
// entre modelos y firmwares, y descartar por un codigo desconocido perderia
// fichajes de verdad. Las lineas sin persona identificada (una tarjeta ajena,
// el estado de la puerta) traen pin=0 o directamente no traen pin, asi que
// quedan afuera solas.
export function parsearTiempoReal(cuerpo) {
  const filas = []
  const invalidas = []

  for (const linea of String(cuerpo ?? '').split(/\r?\n/)) {
    if (!linea.trim()) continue

    const campos = {}
    for (const parte of linea.split('\t')) {
      const corte = parte.indexOf('=')
      if (corte > 0) campos[parte.slice(0, corte).trim()] = parte.slice(corte + 1).trim()
    }

    const pin = (campos.pin ?? '').trim()
    const momento = (campos.time ?? '').trim()

    // Sin pin util no hay a quien atribuirle el fichaje: no es un error, es
    // una linea que no nos interesa.
    if (!pin || pin === '0') continue
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(momento)) {
      invalidas.push(linea)
      continue
    }
    filas.push({ pin, punched_at: momento.replace('T', ' ') })
  }

  return { filas, invalidas }
}

// Respuesta al alta: el equipo espera un codigo que lo identifique. Alcanza
// con devolverle su propia serie, que es lo que ya usamos como identidad.
export function respuestaAlta({ serial }) {
  return `RegistryCode=${serial}`
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
