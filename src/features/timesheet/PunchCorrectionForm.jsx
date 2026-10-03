import { useState } from 'react'
import Field from '../../components/ui/Field'
import TextAreaField from '../../components/ui/TextAreaField'
import { PUNCH_SOURCE_LABELS, PUNCH_TYPE, PUNCH_TYPE_LABELS } from '../../lib/constants'
import { toTimeString } from './workTime'

export const CORRECTION_MODE = {
  AGREGAR: 'agregar',
  CORREGIR: 'corregir',
  ANULAR: 'anular',
}

const INTRO_BY_MODE = {
  [CORRECTION_MODE.AGREGAR]: 'Agregá un fichaje manual para este día.',
  [CORRECTION_MODE.CORREGIR]: 'Se anula el fichaje original y se crea uno manual con la hora corregida. El original queda guardado.',
  [CORRECTION_MODE.ANULAR]: 'El fichaje deja de contar para el cálculo de horas, pero no se borra: queda anulado con su motivo.',
}

function punchInstant(punch) {
  return new Date(punch.punched_at).getTime()
}

// Formulario de las tres correcciones del supervisor. El motivo es
// obligatorio en todas (ver FICHAJE.md). Lo envia el boton "Guardar" del
// modal que lo contiene, via el atributo form={formId}.
export default function PunchCorrectionForm({ mode, punch = null, formId, onSubmit }) {
  const [punchType, setPunchType] = useState(PUNCH_TYPE.ENTRADA)
  const [time, setTime] = useState(() => (punch ? toTimeString(punchInstant(punch)) : ''))
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setValidationError('Indicá el motivo de la corrección.')
      return
    }
    if (mode !== CORRECTION_MODE.ANULAR && !time) {
      setValidationError('Indicá la hora.')
      return
    }
    setValidationError('')
    onSubmit({ punchType: mode === CORRECTION_MODE.CORREGIR ? punch.resolvedType : punchType, time, reason: trimmedReason })
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant">{INTRO_BY_MODE[mode]}</p>

      {punch && (
        <p className="font-body-md text-body-md text-on-surface">
          Fichaje original: <strong>{PUNCH_TYPE_LABELS[punch.resolvedType] ?? 'Sin tipo'}</strong> a las{' '}
          <strong>{toTimeString(punchInstant(punch))}</strong> ({PUNCH_SOURCE_LABELS[punch.source]})
        </p>
      )}

      {mode === CORRECTION_MODE.AGREGAR && (
        <div className="space-y-xs">
          <label htmlFor="punch-type" className="font-label-sm text-label-sm text-on-surface block">
            Tipo
          </label>
          <select
            id="punch-type"
            value={punchType}
            onChange={(event) => setPunchType(event.target.value)}
            className="w-full bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
          >
            {Object.entries(PUNCH_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode !== CORRECTION_MODE.ANULAR && (
        <Field label={mode === CORRECTION_MODE.CORREGIR ? 'Nueva hora' : 'Hora'} type="time" value={time} onChange={setTime} required />
      )}

      <TextAreaField label="Motivo" value={reason} onChange={setReason} required placeholder="Ej.: se olvidó de fichar la salida" />

      {validationError && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {validationError}
        </p>
      )}
    </form>
  )
}
