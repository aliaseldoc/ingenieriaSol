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
// Timeline en VisitDetailPanel.jsx): la clave de este evento puntual.
export const VISIT_EVENT_RESULTADOS_ENVIADOS = 'resultados_enviados'
export const VISIT_EVENT_EXTRA_LABELS = {
  [VISIT_EVENT_RESULTADOS_ENVIADOS]: 'Resultados enviados por mail',
}

// Estados de una visita que el tecnico todavia puede editar.
export const TECHNICIAN_EDITABLE_STATUSES = [
  VISIT_STATUS.PLANIFICADA,
  VISIT_STATUS.BORRADOR,
  VISIT_STATUS.REVISION_SOLICITADA,
]

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

// Cantidad de dias antes del vencimiento del service anual para mostrar la alerta.
export const ANNUAL_SERVICE_ALERT_WINDOW_DAYS = 30

// Nivel de combustible (%) en o por debajo del cual se muestra una alerta.
export const FUEL_ALERT_THRESHOLD_PERCENTAGE = 30

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
    measurement: { key: 'funcionamiento_precalentador_temp', unit: '°C' },
    allowNoTiene: true,
  },
  {
    key: 'cargador_flote',
    category: CHECKLIST_CATEGORY.EQUIPO_PARADO,
    label: 'Cargador de flote Vcc',
    measurement: { key: 'cargador_flote_tension', unit: 'Vcc', specByVoltage: { 12: [12.5, 14], 24: [24.5, 29] } },
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
  { key: 'presion_aceite_frio', label: 'Presión de Aceite (en frío)', unit: 'bar', specMin: 2, specMax: 6 },
  {
    key: 'tension_alternador',
    label: 'Tensión de Alternador de Carga de Baterías',
    unit: 'V',
    specByVoltage: { 12: [12, 14.5], 24: [24, 29] },
  },
  { key: 'tension_generacion_l_n', label: 'Tensión de Generación L-N', unit: 'V', specMin: 210, specMax: 230 },
  { key: 'tension_generacion_l1_l2', label: 'Tensión de Generación L1-L2', unit: 'V' },
  { key: 'frecuencia', label: 'Frecuencia', unit: 'Hz', specMin: 49, specMax: 51 },
  { key: 'presion_aceite_caliente', label: 'Presión de Aceite en Caliente', unit: 'bar', specMin: 2, specMax: 6 },
  { key: 'temperatura_agua', label: 'Temperatura del Motor', unit: '°C', specMin: 50, specMax: 85 },
  // combustible_litros + nivel_combustible se muestran como un unico campo
  // con selector de unidad (ver FuelParameterField.jsx) pero se siguen
  // guardando como 2 filas independientes, sin cambios para los
  // consumidores existentes (markVisitReceived, ParametersTable).
  { key: 'combustible_litros', label: 'Cantidad de Combustible (Litros)', unit: 'L', optional: true },
  { key: 'nivel_combustible', label: 'Nivel de Combustible', unit: '%', specMin: 20, specMax: 100 },
  { key: 'numero_arranques', label: 'Número de Arranques' },
  { key: 'horas_operacion', label: 'Horas de Operación', unit: 'Hs' },
]

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

// Resuelve el rango normal de un parametro/medicion segun el voltaje del
// equipo. Si el parametro no depende del voltaje (no tiene specByVoltage),
// devuelve su specMin/specMax estatico de siempre. Si el voltaje del equipo
// no se puede resolver, cae al rango de 12V para no dejar el campo sin
// ningun hint.
export function resolveSpec(definition, equipment) {
  if (!definition.specByVoltage) return { specMin: definition.specMin ?? null, specMax: definition.specMax ?? null }
  const voltage = getBatteryVoltage(equipment)
  const range = definition.specByVoltage[voltage] ?? definition.specByVoltage[12]
  return { specMin: range[0], specMax: range[1] }
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
