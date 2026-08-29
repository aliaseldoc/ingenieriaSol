import { PRESSURE_UNIT, convertPressure, isValueOutOfSpec, resolveSpec } from '../../lib/constants'

// Las presiones de aceite se cargan en la unidad que marque el manometro del
// equipo (bar o psi). Al cambiar de unidad se convierte el valor ya cargado,
// asi el tecnico no tiene que reescribirlo ni convertir de memoria. La unidad
// elegida vive en el estado del padre (no es local) para poder persistirla
// junto con el resto del formulario.
export default function PressureParameterField({ definition, value, onChangeValue, equipment, unit, onChangeUnit }) {
  const { specMin, specMax } = resolveSpec(definition, equipment, unit)
  const outOfSpec = isValueOutOfSpec(value, specMin, specMax)

  function handleChangeUnit(nextUnit) {
    onChangeValue(convertPressure(value, unit, nextUnit))
    onChangeUnit(nextUnit)
  }

  return (
    <tr>
      <td className="p-md font-medium">{definition.label}</td>
      <td className="p-md">
        <input
          type="number"
          step="any"
          required
          placeholder={`${specMin} – ${specMax}`}
          value={value ?? ''}
          onChange={(event) => onChangeValue(event.target.value)}
          className={`w-full bg-surface border rounded px-md py-sm font-body-lg text-body-lg focus:border-2 focus:outline-none transition-colors ${
            outOfSpec ? 'border-2 border-error text-error' : 'border-outline text-on-surface focus:border-secondary'
          }`}
        />
      </td>
      <td className="p-md text-center">
        <select
          value={unit}
          onChange={(event) => handleChangeUnit(event.target.value)}
          className="bg-surface border border-outline rounded px-sm py-xs font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-colors"
        >
          <option value={PRESSURE_UNIT.BAR}>bar</option>
          <option value={PRESSURE_UNIT.PSI}>psi</option>
        </select>
      </td>
    </tr>
  )
}
