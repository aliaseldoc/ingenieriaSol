import {
  CHECKLIST_CATEGORY,
  CHECKLIST_CATEGORY_LABELS,
  CHECKLIST_ITEM_STATUS,
  CHECKLIST_ITEM_STATUS_LABELS,
  VISIT_CHECKLIST_ITEMS,
  resolveSpec,
  isValueOutOfSpec,
} from '../../lib/constants'

const CATEGORY_ICON = {
  [CHECKLIST_CATEGORY.EQUIPO_PARADO]: 'power_settings_new',
  [CHECKLIST_CATEGORY.EQUIPO_MARCHA]: 'bolt',
}

export default function VisitChecklistSection({ category, checklistData, onChangeItem, equipment }) {
  const items = VISIT_CHECKLIST_ITEMS.filter((item) => item.category === category)
  const hasMeasurementColumn = items.some((item) => item.measurement)

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div className="list-title-bar p-md flex items-center gap-sm">
        <span className="material-symbols-outlined">{CATEGORY_ICON[category]}</span>
        <h3 className="font-label-md text-label-md uppercase">{CHECKLIST_CATEGORY_LABELS[category]}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium">Verificación</th>
              {hasMeasurementColumn && (
                <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium w-[15rem]">Medición</th>
              )}
              <th className="p-md font-label-md text-[1.6rem] text-on-surface-variant uppercase font-medium w-[19rem] text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="font-body-lg text-body-lg text-on-surface divide-y divide-outline-variant/50">
            {items.map((item) => {
              const currentStatus = checklistData[item.key] ?? CHECKLIST_ITEM_STATUS.OK
              const statusOptions = Object.entries(CHECKLIST_ITEM_STATUS_LABELS).filter(
                ([value]) => value !== CHECKLIST_ITEM_STATUS.NO_TIENE || item.allowNoTiene
              )
              const { specMin, specMax } = item.measurement ? resolveSpec(item.measurement, equipment) : {}
              const outOfSpec = item.measurement
                ? isValueOutOfSpec(checklistData[item.measurement.key], specMin, specMax)
                : false
              return (
                <tr key={item.key}>
                  <td className="p-md">{item.label}</td>
                  {hasMeasurementColumn && (
                    <td className="p-md">
                      {item.measurement ? (
                        <div className="flex items-center gap-sm">
                          <input
                            type="number"
                            step="any"
                            required={currentStatus === CHECKLIST_ITEM_STATUS.OK}
                            placeholder={specMin != null && specMax != null ? `${specMin} – ${specMax}` : undefined}
                            value={checklistData[item.measurement.key] ?? ''}
                            onChange={(event) => onChangeItem(item.measurement.key, event.target.value)}
                            className={`w-full bg-surface border rounded px-md py-sm font-body-lg text-body-lg focus:border-2 focus:outline-none transition-colors ${
                              outOfSpec ? 'border-error text-error' : 'border-outline text-on-surface focus:border-secondary'
                            }`}
                          />
                          <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">{item.measurement.unit}</span>
                        </div>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                  )}
                  <td className="p-md text-center">
                    <select
                      required
                      value={currentStatus}
                      onChange={(event) => onChangeItem(item.key, event.target.value)}
                      className="w-full bg-surface border border-outline rounded font-body-lg text-body-lg text-on-surface px-md py-sm focus:border-secondary focus:border-2 focus:outline-none transition-colors"
                    >
                      {statusOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
