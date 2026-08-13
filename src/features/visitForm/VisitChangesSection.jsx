import { VISIT_CHANGES_FIELDS, VISIT_CHANGE_FIELD_TYPE, SI_NO_LABELS } from '../../lib/constants'

export default function VisitChangesSection({ changesData, onChangeField }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div className="list-title-bar p-md flex items-center gap-sm">
        <span className="material-symbols-outlined">build</span>
        <h3 className="font-label-md text-label-md uppercase">Cambios y Agregados</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium">Campo</th>
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium w-[16rem]">Valor</th>
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium w-[10rem] text-center">Unidad</th>
            </tr>
          </thead>
          <tbody className="font-body-lg text-body-lg text-on-surface divide-y divide-outline-variant/50">
            {VISIT_CHANGES_FIELDS.map((field) => (
              <tr key={field.key}>
                <td className="p-md font-medium">{field.label}</td>
                <td className="p-md">
                  {field.type === VISIT_CHANGE_FIELD_TYPE.NUMBER ? (
                    <input
                      type="number"
                      step="any"
                      value={changesData[field.key] ?? ''}
                      onChange={(event) => onChangeField(field.key, event.target.value)}
                      className="w-full bg-surface border border-outline rounded px-md py-sm font-body-lg text-body-lg text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-colors"
                    />
                  ) : (
                    <select
                      value={changesData[field.key] ?? field.defaultValue}
                      onChange={(event) => onChangeField(field.key, event.target.value)}
                      className="w-full bg-surface border border-outline rounded px-md py-sm font-body-lg text-body-lg text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-colors"
                    >
                      {Object.entries(SI_NO_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="p-md text-center text-on-surface-variant">{field.unit ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
