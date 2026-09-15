import Button from '../../components/ui/Button'
import { addDaysToKey, currentWeekStartKey, formatWeekRange } from './workTime'

export default function WeekPicker({ weekStartKey, onChange, disabled = false, children = null }) {
  const isCurrentWeek = weekStartKey === currentWeekStartKey()

  return (
    <div className="flex flex-wrap items-center gap-sm">
      <Button
        variant="secondary-outline"
        icon="chevron_left"
        aria-label="Semana anterior"
        disabled={disabled}
        onClick={() => onChange(addDaysToKey(weekStartKey, -7))}
      />
      <p className="font-label-md text-label-md text-on-surface min-w-[20rem] text-center">Semana del {formatWeekRange(weekStartKey)}</p>
      <Button
        variant="secondary-outline"
        icon="chevron_right"
        aria-label="Semana siguiente"
        disabled={disabled}
        onClick={() => onChange(addDaysToKey(weekStartKey, 7))}
      />
      {!isCurrentWeek && (
        <Button variant="secondary-outline" disabled={disabled} onClick={() => onChange(currentWeekStartKey())}>
          Semana actual
        </Button>
      )}
      {children}
    </div>
  )
}
