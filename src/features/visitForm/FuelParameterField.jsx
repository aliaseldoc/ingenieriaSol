import { useState } from 'react'

// Une combustible_litros y nivel_combustible (2 filas separadas en
// VISIT_PARAMETER_DEFINITIONS) en un unico control con selector de unidad.
// El tecnico carga un solo valor, en la unidad que prefiera; el otro se
// autocompleta si se conoce el tamaño del tanque del equipo.
export default function FuelParameterField({ litrosValue, nivelValue, onChangeLitros, onChangeNivel, tankSize }) {
  const [unit, setUnit] = useState('porcentaje')
  const isLitros = unit === 'litros'
  const value = isLitros ? litrosValue : nivelValue
  const showTankSizeHint = isLitros && !(tankSize > 0)

  return (
    <tr>
      <td className="p-md font-medium">Nivel de Combustible</td>
      <td className="p-md">
        <input
          type="number"
          step="any"
          required
          value={value ?? ''}
          onChange={(event) => (isLitros ? onChangeLitros(event.target.value) : onChangeNivel(event.target.value))}
          className="w-full bg-surface border border-outline rounded px-md py-sm font-body-lg text-body-lg text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-colors"
        />
        {showTankSizeHint && (
          <p className="font-body-sm text-body-sm text-warning mt-xs">
            Cargá el Tamaño de Tanque en la ficha técnica para calcular el %.
          </p>
        )}
      </td>
      <td className="p-md text-center">
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="bg-surface border border-outline rounded px-sm py-xs font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-colors"
        >
          <option value="porcentaje">%</option>
          <option value="litros">Lts</option>
        </select>
      </td>
    </tr>
  )
}
