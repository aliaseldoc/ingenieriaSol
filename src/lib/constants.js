export const ROLES = {
  ADMINISTRATIVO: 'administrativo',
  TECNICO: 'tecnico',
  SUPERVISOR: 'supervisor',
}

export const ROLE_LABELS = {
  [ROLES.ADMINISTRATIVO]: 'Administrativo',
  [ROLES.TECNICO]: 'Técnico',
  [ROLES.SUPERVISOR]: 'Supervisor',
}

export const ROLE_HOME_PATH = {
  [ROLES.ADMINISTRATIVO]: '/admin',
  [ROLES.TECNICO]: '/tecnico',
  [ROLES.SUPERVISOR]: '/supervisor',
}

export const VISIT_STATUS = {
  PLANIFICADA: 'planificada',
  BORRADOR: 'borrador',
  ENVIADA: 'enviada',
  REVISION_SOLICITADA: 'revision_solicitada',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
}

export const VISIT_STATUS_LABELS = {
  [VISIT_STATUS.PLANIFICADA]: 'Planificada',
  [VISIT_STATUS.BORRADOR]: 'Borrador',
  [VISIT_STATUS.ENVIADA]: 'Enviada',
  [VISIT_STATUS.REVISION_SOLICITADA]: 'Revisión Solicitada',
  [VISIT_STATUS.APROBADA]: 'Aprobada',
  [VISIT_STATUS.RECHAZADA]: 'Rechazada',
}

// visit_events tambien registra hitos que no son un cambio de status (ver
// Timeline en VisitDetailPanel.jsx): las claves de esos eventos puntuales.
export const VISIT_EVENT_RESULTADOS_ENVIADOS = 'resultados_enviados'
// Nota informativa del supervisor al tecnico: no cambia el estado de la
// visita y le llega como aviso en la app (ver SupervisorNotesContext.jsx).
export const VISIT_EVENT_NOTA_SUPERVISOR = 'nota_supervisor'
// "Reparacion Solicitada" de la validacion: la visita queda aprobada y se abre
// un caso en Reparaciones (ver request_visit_repair en 0024).
export const VISIT_EVENT_REPARACION_SOLICITADA = 'reparacion_solicitada'
export const VISIT_EVENT_EXTRA_LABELS = {
  [VISIT_EVENT_RESULTADOS_ENVIADOS]: 'Resultados enviados por mail',
  [VISIT_EVENT_NOTA_SUPERVISOR]: 'Nota del supervisor',
  [VISIT_EVENT_REPARACION_SOLICITADA]: 'Aprobada · Reparación solicitada',
}

// Estados de una visita que el tecnico todavia puede editar.
export const TECHNICIAN_EDITABLE_STATUSES = [
  VISIT_STATUS.PLANIFICADA,
  VISIT_STATUS.BORRADOR,
  VISIT_STATUS.REVISION_SOLICITADA,
]

// Casos de la vista Reparaciones (ver 0024): los abre el supervisor con
// "Reparacion Solicitada" y los siguen supervisor y administrativo.
export const REPAIR_STATUS = {
  PENDIENTE_PRESUPUESTO: 'pendiente_presupuesto',
  PRESUPUESTO_ENVIADO: 'presupuesto_enviado',
  APROBADA: 'aprobada',
  EN_EJECUCION: 'en_ejecucion',
  FINALIZADA: 'finalizada',
  CANCELADA: 'cancelada',
}

// En el orden en que avanza un caso: el selector de estado y los filtros de
// la vista siguen este mismo orden.
export const REPAIR_STATUS_LABELS = {
  [REPAIR_STATUS.PENDIENTE_PRESUPUESTO]: 'Pendiente de Presupuesto',
  [REPAIR_STATUS.PRESUPUESTO_ENVIADO]: 'Presupuesto Enviado',
  [REPAIR_STATUS.APROBADA]: 'Aprobada por el Cliente',
  [REPAIR_STATUS.EN_EJECUCION]: 'En Ejecución',
  [REPAIR_STATUS.FINALIZADA]: 'Finalizada',
  [REPAIR_STATUS.CANCELADA]: 'Cancelada',
}

export const REPAIR_STATUS_TONE = {
  [REPAIR_STATUS.PENDIENTE_PRESUPUESTO]: 'warning',
  [REPAIR_STATUS.PRESUPUESTO_ENVIADO]: 'neutral',
  [REPAIR_STATUS.APROBADA]: 'success',
  [REPAIR_STATUS.EN_EJECUCION]: 'warning',
  [REPAIR_STATUS.FINALIZADA]: 'success',
  [REPAIR_STATUS.CANCELADA]: 'error',
}

// Un caso sigue abierto hasta que se finaliza o se cancela.
export const OPEN_REPAIR_STATUSES = [
  REPAIR_STATUS.PENDIENTE_PRESUPUESTO,
  REPAIR_STATUS.PRESUPUESTO_ENVIADO,
  REPAIR_STATUS.APROBADA,
  REPAIR_STATUS.EN_EJECUCION,
]

// Fecha del caso que se completa sola (con la de hoy) al pasar a ese estado,
// si todavia estaba vacia. Despues se puede corregir a mano.
export const REPAIR_STATUS_DATE_FIELD = {
  [REPAIR_STATUS.PRESUPUESTO_ENVIADO]: 'budget_sent_at',
  [REPAIR_STATUS.APROBADA]: 'client_approved_at',
  [REPAIR_STATUS.FINALIZADA]: 'completed_at',
}

export const REPAIR_EVENT_TYPE = {
  CREADA: 'creada',
  ESTADO: 'estado',
  NOTA: 'nota',
  DATOS: 'datos',
}

export const SERVICE_TYPE = {
  PREVENTIVO: 'preventivo',
  CORRECTIVO: 'correctivo',
  INSTALACION: 'instalacion',
  INSPECCION: 'inspeccion',
}

export const SERVICE_TYPE_LABELS = {
  [SERVICE_TYPE.PREVENTIVO]: 'Mantenimiento Preventivo',
  [SERVICE_TYPE.CORRECTIVO]: 'Reparación Correctiva',
  [SERVICE_TYPE.INSTALACION]: 'Instalación/Puesta en marcha',
  [SERVICE_TYPE.INSPECCION]: 'Inspección de Rutina',
}

// Solo aplica cuando service_type = preventivo: de que visita mensual se
// trata (algunos equipos se visitan 1 o 2 veces por mes, ver CLAUDE.md).
export const VISIT_OCCURRENCE = {
  PRIMERA: 'primera',
  SEGUNDA: 'segunda',
}

export const VISIT_OCCURRENCE_LABELS = {
  [VISIT_OCCURRENCE.PRIMERA]: 'Primera Visita',
  [VISIT_OCCURRENCE.SEGUNDA]: 'Segunda Visita',
}

export const FUEL_TYPE = {
  DIESEL: 'diesel',
  NAFTA: 'nafta',
  GAS: 'gas',
}

export const FUEL_TYPE_LABELS = {
  [FUEL_TYPE.DIESEL]: 'Diésel',
  [FUEL_TYPE.NAFTA]: 'Nafta',
  [FUEL_TYPE.GAS]: 'Gas',
}

export const CONDITION_STATUS = {
  OPTIMO: 'optimo',
  ATENCION: 'atencion',
  FUERA_SERVICIO: 'fuera_servicio',
}

export const CONDITION_STATUS_LABELS = {
  [CONDITION_STATUS.OPTIMO]: 'Óptimo',
  [CONDITION_STATUS.ATENCION]: 'Requiere Atención',
  [CONDITION_STATUS.FUERA_SERVICIO]: 'Fuera de Servicio',
}

// Un cliente inactivo (ver 0023) conserva su ficha y su historial, pero sale
// de la operacion: sus equipos no se planifican ni generan alertas. Sin el
// dato (un embed que no pidio `active`) se lo toma como activo.
export function isActiveClient(client) {
  return client?.active !== false
}

// Cantidad de dias antes del vencimiento del service anual para mostrar la alerta.
export const ANNUAL_SERVICE_ALERT_WINDOW_DAYS = 30

// Nivel de combustible (%) en o por debajo del cual se muestra una alerta.
export const FUEL_ALERT_THRESHOLD_PERCENTAGE = 30

// Alertas silenciadas por el supervisor (ver 0018_silenciar_alertas.sql). No se
// guarda un booleano sino el valor que se silencio, asi la alerta se oculta
// solo mientras la condicion siga siendo exactamente la misma: en cuanto
// cambia (se cargo combustible, se hizo el service) los valores dejan de
// coincidir y la alerta vuelve sola, sin necesidad de limpiar nada.
//
// Number() a proposito: PostgREST puede devolver un numeric como numero o como
// string, y `20 === '20'` seria false.
// (El equivalente para el service anual, isAnnualAlertMuted, vive en
// dateUtils.js porque necesita comparar fechas — este archivo no puede
// importar de ahi sin generar un ciclo.)
export function isFuelAlertMuted(equipment) {
  if (equipment?.fuel_alert_muted_percentage == null || equipment?.fuel_percentage == null) return false
  return Number(equipment.fuel_alert_muted_percentage) === Number(equipment.fuel_percentage)
}

// Categorias del checklist tecnico, segun el diseno de "Informe de Visita de
// Servicio" (Desing/stitch_ingenieria_sol_service_portal/stitch_ingenieria_sol_service_portal (1)).
export const CHECKLIST_CATEGORY = {
  EQUIPO_PARADO: 'equipo_parado',
  EQUIPO_MARCHA: 'equipo_marcha',
}

export const CHECKLIST_CATEGORY_LABELS = {
  [CHECKLIST_CATEGORY.EQUIPO_PARADO]: 'Operaciones: Equipo Parado',
  [CHECKLIST_CATEGORY.EQUIPO_MARCHA]: 'Operaciones: Equipo en Marcha',
}

export const CHECKLIST_ITEM_STATUS = {
  OK: 'ok',
  A_REVISAR: 'a_revisar',
  FALLA: 'falla',
  NO_TIENE: 'no_tiene',
}

export const CHECKLIST_ITEM_STATUS_LABELS = {
  [CHECKLIST_ITEM_STATUS.OK]: 'OK',
  [CHECKLIST_ITEM_STATUS.A_REVISAR]: 'A Revisar',
  [CHECKLIST_ITEM_STATUS.FALLA]: 'Falla',
  [CHECKLIST_ITEM_STATUS.NO_TIENE]: 'No tiene',
}

export const VISIT_CHECKLIST_ITEMS = [
  { key: 'revision_general_equipo', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Revisión general del equipo' },
  { key: 'mangueras_agua_radiador', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Control de estado de mangueras de agua de radiador' },
  { key: 'control_correas', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Control de correas' },
  { key: 'perdidas_agua_parado', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Pérdidas de agua' },
  { key: 'ajuste_abrazaderas', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Ajuste de abrazaderas' },
  { key: 'estado_baterias', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Estado de las baterías' },
  { key: 'control_nivel_aceite', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Control de nivel de aceite' },
  {
    key: 'funcionamiento_precalentador',
    category: CHECKLIST_CATEGORY.EQUIPO_PARADO,
    label: 'Funcionamiento de precalentador',
    measurement: { key: 'funcionamiento_precalentador_temp', unit: '°C', specMin: 30, specMax: 40 },
    allowNoTiene: true,
  },
  {
    key: 'cargador_flote',
    category: CHECKLIST_CATEGORY.EQUIPO_PARADO,
    label: 'Cargador de flote Vcc',
    measurement: { key: 'cargador_flote_tension', unit: 'Vcc', specByVoltage: { 12: [12, 14], 24: [25, 28] } },
  },
  { key: 'limpieza_general_sala', category: CHECKLIST_CATEGORY.EQUIPO_PARADO, label: 'Limpieza general de la sala (o de la cabina)' },
  { key: 'comprobar_presion_aceite', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Comprobar presión de aceite' },
  { key: 'verificar_perdidas_agua', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Verificar pérdidas de agua' },
  { key: 'verificar_perdidas_aceite', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Verificar pérdidas de aceite' },
  { key: 'verificar_perdidas_combustible', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Verificar pérdidas de combustible' },
  { key: 'comprobar_carga_baterias', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Comprobar carga de baterías' },
  { key: 'comprobar_temperatura_agua', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Comprobar temperatura del agua' },
  { key: 'comprobar_tension_frecuencia', category: CHECKLIST_CATEGORY.EQUIPO_MARCHA, label: 'Comprobar tensión de generación y frecuencia' },
]

// Parametros cuantitativos medidos durante la visita. Orden = orden de
// renderizado en el formulario tecnico (ver VisitParametersForm.jsx).
export const VISIT_PARAMETER_DEFINITIONS = [
  { key: 'presion_aceite_frio', label: 'Presión de Aceite (en frío)', unit: 'bar', specByUnit: { bar: [4, 8], psi: [58, 116] } },
  {
    key: 'tension_alternador',
    label: 'Tensión de Alternador de Carga de Baterías',
    unit: 'V',
    specByVoltage: { 12: [14, 14.8], 24: [27, 29] },
  },
  { key: 'tension_generacion_l_n', label: 'Tensión de Generación L-N', unit: 'V', specMin: 215, specMax: 233 },
  { key: 'tension_generacion_l1_l2', label: 'Tensión de Generación L1-L2', unit: 'V', specMin: 375, specMax: 403 },
  { key: 'frecuencia', label: 'Frecuencia', unit: 'Hz', specMin: 49.5, specMax: 53 },
  {
    key: 'presion_aceite_caliente',
    label: 'Presión de Aceite en Caliente',
    unit: 'bar',
    specByUnit: { bar: [3, 6], psi: [43.5, 87] },
  },
  { key: 'temperatura_agua', label: 'Temperatura del Motor', unit: '°C', specMin: 55, specMax: 75 },
  // combustible_litros + nivel_combustible se muestran como un unico campo
  // con selector de unidad (ver FuelParameterField.jsx) pero se siguen
  // guardando como 2 filas independientes, sin cambios para los
  // consumidores existentes (markVisitReceived, ParametersTable).
  { key: 'combustible_litros', label: 'Cantidad de Combustible (Litros)', unit: 'L', optional: true },
  { key: 'nivel_combustible', label: 'Nivel de Combustible', unit: '%', specMin: 20, specMax: 100 },
  // lastValueField: columna de equipment donde quedo espejado el ultimo
  // valor recibido, para ofrecerlo como referencia en el formulario.
  { key: 'numero_arranques', label: 'Número de Arranques', lastValueField: 'starts_count' },
  { key: 'horas_operacion', label: 'Horas de Operación', unit: 'Hs', lastValueField: 'hours_of_use' },
]

// Las presiones de aceite se pueden cargar en bar o en psi, segun lo que
// marque el manometro del equipo. El valor se guarda tal cual lo cargo el
// tecnico, junto con la unidad elegida y el rango normal expresado en esa
// misma unidad — asi la revision, el detalle y el mail al cliente leen la
// fila de visit_parameters sin tener que convertir nada.
export const PRESSURE_UNIT = {
  BAR: 'bar',
  PSI: 'psi',
}

const BAR_TO_PSI = 14.5038

// La unidad elegida vive en checklist_data, con el mismo criterio que
// combustible_unidad (ver FuelParameterField.jsx).
export function getPressureUnitKey(definition) {
  return `${definition.key}_unidad`
}

export function getPressureUnit(definition, checklistData) {
  return checklistData?.[getPressureUnitKey(definition)] ?? PRESSURE_UNIT.BAR
}

// Unidad con la que se graba la fila: la elegida por el tecnico si el
// parametro admite varias, la fija de la definicion si no.
export function resolveUnit(definition, pressureUnit) {
  return definition.specByUnit ? pressureUnit : definition.unit
}

export function convertPressure(value, fromUnit, toUnit) {
  if (value === '' || value == null || fromUnit === toUnit) return value
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return value
  const converted = toUnit === PRESSURE_UNIT.PSI ? numericValue * BAR_TO_PSI : numericValue / BAR_TO_PSI
  return String(Math.round(converted * 10) / 10)
}

// Un equipo de 1 bateria funciona a 12V, de 2 baterias a 24V. battery_quantity
// es texto libre en la ficha tecnica (no select), asi que puede traer datos
// "sucios" (ej. "2 baterias") — cualquier valor que no sea exactamente 1 o 2
// se trata como voltaje desconocido.
export function getBatteryVoltage(equipment) {
  const quantity = Number(String(equipment?.battery_quantity ?? '').trim())
  if (quantity === 1) return 12
  if (quantity === 2) return 24
  return null
}

// Resuelve el rango normal de un parametro/medicion: expresado en la unidad
// elegida si depende de ella (specByUnit, las presiones), segun el voltaje
// del equipo si depende de el (specByVoltage), o el specMin/specMax estatico
// de la definicion en el resto de los casos. Si el voltaje del equipo no se
// puede resolver, cae al rango de 12V para no dejar el campo sin ningun hint.
export function resolveSpec(definition, equipment, pressureUnit = PRESSURE_UNIT.BAR) {
  if (definition.specByUnit) {
    const range = definition.specByUnit[pressureUnit] ?? definition.specByUnit[PRESSURE_UNIT.BAR]
    return { specMin: range[0], specMax: range[1] }
  }
  if (!definition.specByVoltage) return { specMin: definition.specMin ?? null, specMax: definition.specMax ?? null }
  const voltage = getBatteryVoltage(equipment)
  const range = definition.specByVoltage[voltage] ?? definition.specByVoltage[12]
  return { specMin: range[0], specMax: range[1] }
}

// Unidad en la que el tecnico carga el combustible en la visita; queda
// espejada en la ficha del equipo al recibirla.
export const FUEL_LEVEL_UNIT = {
  LITROS: 'litros',
  PORCENTAJE: 'porcentaje',
}

// Nivel de combustible de la ficha, en la misma unidad en que se relevo: si
// la visita se cargo en litros se muestra en litros, si no en porcentaje.
// Devuelve null cuando el equipo todavia no tiene ninguna medicion.
export function formatFuelLevel(equipment) {
  if (equipment?.fuel_level_unit === FUEL_LEVEL_UNIT.LITROS && equipment?.fuel_liters != null) {
    return `${equipment.fuel_liters} L`
  }
  return equipment?.fuel_percentage != null ? `${equipment.fuel_percentage}%` : null
}

// Ultimo valor de esta metrica que quedo registrado en la ficha del equipo
// (se actualiza al recibir la visita, ver markVisitReceived). Sirve de
// referencia para el tecnico, no de rango: no participa de la validacion.
export function getLastRecordedValue(definition, equipment) {
  if (!definition.lastValueField) return null
  return equipment?.[definition.lastValueField] ?? null
}

export function isValueOutOfSpec(value, specMin, specMax) {
  if (value == null || value === '') return false
  const numericValue = Number(value)
  if (specMin != null && numericValue < specMin) return true
  if (specMax != null && numericValue > specMax) return true
  return false
}

export const VISIT_CHANGE_FIELD_TYPE = {
  NUMBER: 'number',
  SI_NO: 'si_no',
}

export const SI_NO_LABELS = { no: 'No', si: 'Sí' }

// Recuadro "Cambios y Agregados" del formulario tecnico, debajo de
// "Operaciones: Equipo en Marcha". Igual que VISIT_CHECKLIST_ITEMS, agregar
// un campo nuevo aca no requiere migracion (se guarda en visits.changes_data,
// jsonb) — solo los 4 campos "cambio_*" tienen equivalente en la ficha
// tecnica del equipo (ver VISIT_CHANGE_TO_EQUIPMENT_TRACKING); los litros
// agregados son registro informativo de la visita, sin vencimiento asociado.
export const VISIT_CHANGES_FIELDS = [
  { key: 'agregado_aceite_litros', label: 'Agregado de Aceite', type: VISIT_CHANGE_FIELD_TYPE.NUMBER, unit: 'Litros', defaultValue: '' },
  {
    key: 'agregado_liquido_refrigerante_litros',
    label: 'Agregado de Líquido Refrigerante',
    type: VISIT_CHANGE_FIELD_TYPE.NUMBER,
    unit: 'Litros',
    defaultValue: '',
  },
  { key: 'agregado_combustible_litros', label: 'Agregado de Combustible', type: VISIT_CHANGE_FIELD_TYPE.NUMBER, unit: 'Litros', defaultValue: '' },
  { key: 'cambio_filtro_combustible', label: 'Cambio Filtro de Combustible', type: VISIT_CHANGE_FIELD_TYPE.SI_NO, defaultValue: 'no' },
  { key: 'cambio_filtro_aceite', label: 'Cambio Filtro de Aceite', type: VISIT_CHANGE_FIELD_TYPE.SI_NO, defaultValue: 'no' },
  { key: 'cambio_filtro_aire', label: 'Cambio Filtro de Aire', type: VISIT_CHANGE_FIELD_TYPE.SI_NO, defaultValue: 'no' },
  { key: 'cambio_bateria', label: 'Cambio de Batería', type: VISIT_CHANGE_FIELD_TYPE.SI_NO, defaultValue: 'no' },
]

// Que columna de la ficha tecnica del equipo (y con cuantos años de
// vigencia) actualiza cada "cambio_*" al recibir la visita (ver
// markVisitReceived en src/api/visits.js) — mismo criterio +1/+2 años que ya
// usa EquipmentHistoryPanel.jsx al editar el seguimiento a mano.
export const VISIT_CHANGE_TO_EQUIPMENT_TRACKING = [
  { changeKey: 'cambio_filtro_combustible', changedAtField: 'fuel_filter_changed_at', nextDueField: 'fuel_filter_next_due_at', yearsAhead: 1 },
  { changeKey: 'cambio_filtro_aceite', changedAtField: 'oil_filter_changed_at', nextDueField: 'oil_filter_next_due_at', yearsAhead: 1 },
  { changeKey: 'cambio_filtro_aire', changedAtField: 'air_filter_changed_at', nextDueField: 'air_filter_next_due_at', yearsAhead: 1 },
  { changeKey: 'cambio_bateria', changedAtField: 'battery_changed_at', nextDueField: 'battery_next_due_at', yearsAhead: 2 },
]

// Modulo de fichaje (ver FICHAJE.md). Las reglas son iguales para todo el
// personal: cambiar un valor aca cambia el calculo del reporte del
// supervisor, la vista del tecnico y la foto que se guarda al cerrar.
export const TIMESHEET_RULES = {
  timeZone: 'America/Argentina/Buenos_Aires',
  dailyNormalMinutes: 9 * 60,
  lunchDiscountMinutes: 60,
  saturdayCutoffTime: '13:00',
  clockReboundMinutes: 2,
  maxShiftHours: 16,
  duplicateWarningMinutes: 10,
  geolocationTimeoutMs: 15000,
}

export const DEFAULT_FACTORY_RADIUS_M = 500

export const PUNCH_SOURCE = {
  RELOJ: 'reloj',
  APP: 'app',
  MANUAL: 'manual',
}

export const PUNCH_SOURCE_LABELS = {
  [PUNCH_SOURCE.RELOJ]: 'Reloj',
  [PUNCH_SOURCE.APP]: 'App',
  [PUNCH_SOURCE.MANUAL]: 'Manual',
}

export const PUNCH_TYPE = {
  ENTRADA: 'entrada',
  SALIDA: 'salida',
}

export const PUNCH_TYPE_LABELS = {
  [PUNCH_TYPE.ENTRADA]: 'Entrada',
  [PUNCH_TYPE.SALIDA]: 'Salida',
}

export const LOCATION_STATUS = {
  OK: 'ok',
  SIN_UBICACION: 'sin_ubicacion',
}

export const LOCATION_ERROR_LABELS = {
  permiso_denegado: 'Permiso de ubicación denegado',
  no_disponible: 'Ubicación no disponible',
  tiempo_agotado: 'Se agotó el tiempo para obtener la ubicación',
}

export const TIMESHEET_WEEK_STATUS = {
  ABIERTA: 'abierta',
  CERRADA: 'cerrada',
}

// Reloj biometrico que manda los fichajes solo por WiFi (protocolo push de
// ZKTeco). El equipo no acepta una ruta: se le carga solo el dominio y el
// puerto, y el arma /iclock/... por su cuenta. El endpoint vive en el deploy
// de Vercel del proyecto (ver api/iclock.js).
export const CLOCK_PUSH_SERVER = {
  host: 'ingenieria-sol.vercel.app',
  port: 443,
  https: true,
}

export const PENDING_PUNCH_REASON_LABELS = {
  sin_legajo: 'Sin legajo',
  semana_cerrada: 'Semana cerrada',
}

export const CLOCK_EVENT_KIND_LABELS = {
  contacto: 'Contacto',
  fichajes: 'Fichajes',
  rechazo: 'Rechazo',
}

// Si el reloj no se comunica en este lapso, la pantalla lo muestra caido.
export const CLOCK_OFFLINE_MINUTES = 30
// Desfasaje de hora a partir del cual conviene corregir el reloj.
export const CLOCK_DRIFT_WARNING_SECONDS = 120
