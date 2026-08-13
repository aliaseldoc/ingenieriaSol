import { VISIT_PARAMETER_DEFINITIONS, resolveSpec, isValueOutOfSpec } from '../../lib/constants'
import FuelParameterField from './FuelParameterField'

export default function VisitParametersForm({ parameterValues, onChangeParameter, equipment }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div className="list-title-bar p-md flex items-center gap-sm">
        <span className="material-symbols-outlined">speed</span>
        <h3 className="font-label-md text-label-md uppercase">Verificación de Parámetros</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium">Parámetro</th>
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium w-[16rem]">Valor Medido</th>
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium w-[10rem] text-center">Unidad</th>
            </tr>
          </thead>
          <tbody className="font-body-lg text-body-lg text-on-surface divide-y divide-outline-variant/50">
            {VISIT_PARAMETER_DEFINITIONS.map((definition) => {
              if (definition.key === 'nivel_combustible') return null
              if (definition.key === 'combustible_litros') {
                return (
                  <FuelParameterField
                    key="combustible"
                    litrosValue={parameterValues.combustible_litros}
                    nivelValue={parameterValues.nivel_combustible}
                    onChangeLitros={(value) => onChangeParameter('combustible_litros', value)}
                    onChangeNivel={(value) => onChangeParameter('nivel_combustible', value)}
                    tankSize={Number(equipment?.fuel_capacity)}
                  />
                )
              }
              const { specMin, specMax } = resolveSpec(definition, equipment)
              const outOfSpec = isValueOutOfSpec(parameterValues[definition.key], specMin, specMax)
              return (
                <tr key={definition.key}>
                  <td className="p-md font-medium">{definition.label}</td>
                  <td className="p-md">
                    <input
                      type="number"
                      step="any"
                      required={!definition.optional}
                      placeholder={specMin != null && specMax != null ? `${specMin} – ${specMax}` : undefined}
                      value={parameterValues[definition.key] ?? ''}
                      onChange={(event) => onChangeParameter(definition.key, event.target.value)}
                      className={`w-full bg-surface border rounded px-md py-sm font-body-lg text-body-lg focus:border-2 focus:outline-none transition-colors ${
                        outOfSpec ? 'border-error text-error' : 'border-outline text-on-surface focus:border-secondary'
                      }`}
                    />
                  </td>
                  <td className="p-md text-center text-on-surface-variant">{definition.unit}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
