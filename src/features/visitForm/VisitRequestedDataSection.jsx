import Field from '../../components/ui/Field'
import { FUEL_TYPE_LABELS } from '../../lib/constants'
import { FIELD_TARGET, FIELD_TYPE, MISSING_DATA_FIELDS } from '../missingData/missingData'

const SELECT_CLASS =
  'w-full bg-surface-container-lowest border border-outline rounded-lg px-md py-sm font-body-md text-body-md text-on-surface hover:border-on-surface-variant focus:border-secondary focus:border-2 focus:outline-none transition-all'

function RequestedField({ field, value, onChange }) {
  if (field.type === FIELD_TYPE.FUEL) {
    return (
      <div className="space-y-xs">
        <label htmlFor={`relevar-${field.key}`} className="font-label-sm text-label-sm text-on-surface block">
          {field.label}
        </label>
        <select id={`relevar-${field.key}`} value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>
          <option value="">Sin dato</option>
          {Object.entries(FUEL_TYPE_LABELS).map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>{label}</option>
          ))}
        </select>
      </div>
    )
  }
  const inputProps = field.type === FIELD_TYPE.NUMBER ? { type: 'number', step: 'any', min: '0' } : { type: field.type === FIELD_TYPE.EMAIL ? 'email' : 'text' }
  return <Field label={field.label} value={value} onChange={onChange} {...inputProps} />
}

// Los datos que el administrativo pidio relevar en este equipo (equipment.
// requested_data_fields, ver 0032), con un campo por dato. No son
// obligatorios: el tecnico carga lo que pueda conseguir. Tambien se muestra lo
// que ya cargo aunque el pedido haya cambiado, para no esconderlo.
export default function VisitRequestedDataSection({ requestedKeys, collectedData, onChangeField }) {
  const keys = new Set([
    ...(requestedKeys ?? []),
    ...Object.entries(collectedData ?? {})
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key]) => key),
  ])
  const fields = MISSING_DATA_FIELDS.filter((field) => field.requestable && keys.has(field.key))
  if (fields.length === 0) return null

  const groups = [
    { title: 'Equipo', fields: fields.filter((field) => field.target === FIELD_TARGET.EQUIPO) },
    { title: 'Contacto del cliente', fields: fields.filter((field) => field.target === FIELD_TARGET.CLIENTE) },
  ].filter((group) => group.fields.length > 0)

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div className="list-title-bar p-md flex items-center gap-sm">
        <span className="material-symbols-outlined">assignment_late</span>
        <h3 className="font-label-md text-label-md uppercase">Datos a Relevar</h3>
      </div>
      <div className="p-md space-y-md">
        <p className="font-body-md text-body-md text-on-surface-variant">
          El administrativo pidió que releves estos datos. Cargá los que puedas conseguir: no son obligatorios.
        </p>
        {groups.map((group) => (
          <div key={group.title} className="space-y-sm">
            <h4 className="font-label-md text-label-md text-on-surface uppercase">{group.title}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {group.fields.map((field) => (
                <RequestedField
                  key={field.key}
                  field={field}
                  value={collectedData?.[field.key] ?? ''}
                  onChange={(value) => onChangeField(field.key, value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
