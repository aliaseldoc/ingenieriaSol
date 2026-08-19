import StatusChip from '../../components/ui/StatusChip'
import { VISIT_PARAMETER_DEFINITIONS, isValueOutOfSpec } from '../../lib/constants'

const PARAMETER_ORDER = new Map(VISIT_PARAMETER_DEFINITIONS.map((definition, index) => [definition.key, index]))

// combustible_litros y nivel_combustible se guardan las dos (el tecnico solo
// carga una, la otra se autocalcula si se conoce el tanque) pero el informe
// muestra una sola fila: la unidad que el tecnico eligio en el formulario.
const HIDDEN_FUEL_KEY_BY_UNIT = { litros: 'nivel_combustible', porcentaje: 'combustible_litros' }

export default function ParametersTable({ parameters, fuelUnit = 'porcentaje' }) {
  if (parameters.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">Sin parámetros registrados.</p>
  }

  const hiddenFuelKey = HIDDEN_FUEL_KEY_BY_UNIT[fuelUnit]
  const visibleParameters = parameters.filter((parameter) => parameter.metric_key !== hiddenFuelKey)

  // El SELECT no garantiza orden propio: se ordena por la posicion canonica
  // de cada metrica en VISIT_PARAMETER_DEFINITIONS para que esta vista de
  // solo lectura siempre coincida visualmente con el formulario del tecnico.
  const orderedParameters = [...visibleParameters].sort(
    (a, b) => (PARAMETER_ORDER.get(a.metric_key) ?? 0) - (PARAMETER_ORDER.get(b.metric_key) ?? 0)
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant">
            <th className="font-label-md text-label-md text-on-surface-variant uppercase py-xs pr-sm">Parámetro</th>
            <th className="font-label-md text-label-md text-on-surface-variant uppercase py-xs pr-sm">Valor</th>
            <th className="font-label-md text-label-md text-on-surface-variant uppercase py-xs">Estado</th>
          </tr>
        </thead>
        <tbody>
          {orderedParameters.map((parameter) => {
            const outOfSpec = isValueOutOfSpec(parameter.value, parameter.spec_min, parameter.spec_max)
            return (
              <tr key={parameter.id} className="border-b border-outline-variant/50">
                <td className="font-body-md text-body-md text-on-surface py-xs pr-sm">{parameter.metric_label}</td>
                <td className={`font-body-lg text-body-lg py-xs pr-sm ${outOfSpec ? 'text-error' : 'text-on-surface'}`}>
                  {parameter.value ?? '—'} {parameter.unit ?? ''}
                </td>
                <td className="py-xs">
                  {outOfSpec ? (
                    <StatusChip label="Fuera de Rango" tone="error" variant="tag" />
                  ) : (
                    <StatusChip label="Óptimo" tone="success" variant="tag" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
