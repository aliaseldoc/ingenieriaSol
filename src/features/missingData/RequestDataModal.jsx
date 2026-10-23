import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import { updateEquipment } from '../../api/equipment'
import { FIELD_TARGET, MISSING_DATA_FIELDS } from './missingData'

const FORM_ID = 'request-data-form'

// "Pedir al tecnico": se eligen los datos que tiene que relevar en la proxima
// visita a este equipo (equipment.requested_data_fields). Al abrir quedan
// marcados los ya pedidos o, si no habia pedido, todos los que faltan.
// Destildar todo cancela el pedido. Se monta al abrirse.
export default function RequestDataModal({ equipment, candidates, onClose, onSaved }) {
  const requestedKeys = equipment.requested_data_fields ?? []
  const [selected, setSelected] = useState(
    () => new Set(requestedKeys.length > 0 ? requestedKeys : candidates.map((field) => field.key))
  )
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function toggle(key) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    try {
      // En el orden del catalogo, que es el que ve el tecnico.
      const keys = MISSING_DATA_FIELDS.filter((field) => selected.has(field.key)).map((field) => field.key)
      await updateEquipment(equipment.id, { requested_data_fields: keys })
      await onSaved()
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo guardar el pedido.')
      setSaving(false)
    }
  }

  const groups = [
    { title: 'Equipo', fields: candidates.filter((field) => field.target === FIELD_TARGET.EQUIPO) },
    { title: 'Contacto del cliente', fields: candidates.filter((field) => field.target === FIELD_TARGET.CLIENTE) },
  ].filter((group) => group.fields.length > 0)

  return (
    <Modal
      open
      title={`Pedir datos al técnico · ${equipment.motor ?? ''}`}
      onClose={saving ? () => {} : onClose}
      actions={[
        { label: 'Cancelar', variant: 'secondary-outline', onClick: onClose, disabled: saving },
        { label: saving ? 'Guardando…' : 'Guardar Pedido', variant: 'primary', type: 'submit', form: FORM_ID, disabled: saving },
      ]}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-md">
        <p className="font-body-md text-body-md text-on-surface-variant">
          Aparecen en el formulario de la próxima visita a este equipo, sea quien sea el técnico. Al recibir la visita se copian a la ficha.
        </p>
        {groups.map((group) => (
          <fieldset key={group.title} className="space-y-xs">
            <legend className="font-label-md text-label-md text-on-surface uppercase mb-xs">{group.title}</legend>
            {group.fields.map((field) => (
              <label key={field.key} className="flex items-center gap-sm font-body-md text-body-md text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(field.key)}
                  onChange={() => toggle(field.key)}
                  disabled={saving}
                  className="w-[1.8rem] h-[1.8rem] accent-secondary"
                />
                {field.label}
              </label>
            ))}
          </fieldset>
        ))}
        {selected.size === 0 && requestedKeys.length > 0 && (
          <p className="font-body-sm text-body-sm text-warning">Sin datos marcados, se cancela el pedido.</p>
        )}
        {errorMessage && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {errorMessage}
          </p>
        )}
      </form>
    </Modal>
  )
}
