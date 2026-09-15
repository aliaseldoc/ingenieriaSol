import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTimesheetWeek } from '../../hooks/useTimesheetWeek'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import StatusChip from '../../components/ui/StatusChip'
import WeekPicker from '../../features/timesheet/WeekPicker'
import WeekGrid from '../../features/timesheet/WeekGrid'
import DayPunchesModal from '../../features/timesheet/DayPunchesModal'
import WeeklyReportSection from '../../features/timesheet/WeeklyReportSection'
import ImportClockFile from '../../features/timesheet/ImportClockFile'
import FactoryLocationSettings from '../../features/timesheet/FactoryLocationSettings'
import { markHoliday, unmarkHoliday } from '../../api/holidays'
import { WEEK_FILTER, WEEK_FILTER_LABELS } from '../../features/timesheet/punchFlags'
import { currentWeekStartKey, isValidWeekStartKey } from '../../features/timesheet/workTime'

const TAB = {
  SEMANA: 'semana',
  REPORTE: 'reporte',
  IMPORTAR: 'importar',
  FABRICA: 'fabrica',
}

const TABS = [
  { key: TAB.SEMANA, label: 'Semana' },
  { key: TAB.REPORTE, label: 'Reporte' },
  { key: TAB.IMPORTAR, label: 'Importar reloj' },
  { key: TAB.FABRICA, label: 'Fábrica' },
]

const WEEK_TABS = [TAB.SEMANA, TAB.REPORTE]

// Pestaña, semana y filtro viven en la URL (?tab=&semana=&filtro=): asi las
// alertas del Panel de Control pueden abrir directamente lo que hay que revisar.
export default function TimesheetPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((item) => item.key === searchParams.get('tab')) ? searchParams.get('tab') : TAB.SEMANA
  const weekStartKey = isValidWeekStartKey(searchParams.get('semana')) ? searchParams.get('semana') : currentWeekStartKey()
  const filter = WEEK_FILTER_LABELS[searchParams.get('filtro')] ? searchParams.get('filtro') : WEEK_FILTER.TODOS

  const timesheet = useTimesheetWeek(weekStartKey)
  const [selectedCell, setSelectedCell] = useState(null) // { employeeId, dateKey }
  const [savingHolidayKey, setSavingHolidayKey] = useState(null)
  const [holidayError, setHolidayError] = useState('')
  const holidayKeys = new Set(timesheet.holidays.map((holiday) => holiday.date))

  // Check de feriado del encabezado de la grilla: aplica a todo el personal
  // y el reporte se recalcula al recargar la semana.
  async function handleToggleHoliday(dateKey, isHoliday) {
    setSavingHolidayKey(dateKey)
    setHolidayError('')
    try {
      if (isHoliday) await markHoliday(dateKey)
      else await unmarkHoliday(dateKey)
      await timesheet.reload()
    } catch (error) {
      setHolidayError(error?.message || 'No se pudo actualizar el feriado.')
    } finally {
      setSavingHolidayKey(null)
    }
  }

  function updateParams(changes) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  // La fila y el dia se buscan en cada render: despues de una correccion el
  // hook recalcula y el modal muestra los datos nuevos sin cerrarse.
  const selectedRow = selectedCell ? timesheet.rows.find((row) => row.employeeId === selectedCell.employeeId) : null
  const selectedDay = selectedRow?.days.find((day) => day.dateKey === selectedCell.dateKey) ?? null

  function renderWeekTab() {
    if (timesheet.loading && !timesheet.hasData) return <Spinner label="Cargando fichajes…" />
    if (timesheet.error) {
      return (
        <p role="alert" className="font-body-md text-body-md text-error">
          No se pudieron cargar los fichajes. {timesheet.error.message}
        </p>
      )
    }
    if (tab === TAB.SEMANA) {
      return (
        <>
          {holidayError && (
            <p role="alert" className="font-body-sm text-body-sm text-error mb-sm">
              {holidayError}
            </p>
          )}
          {timesheet.isClosed && (
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-sm">
              La semana está cerrada: para cambiar feriados o corregir fichajes, reabrila desde la pestaña Reporte.
            </p>
          )}
          <WeekGrid
            weekStartKey={weekStartKey}
            rows={timesheet.rows}
            settings={timesheet.settings}
            filter={filter}
            holidayKeys={holidayKeys}
            holidaysLocked={timesheet.isClosed}
            savingHolidayKey={savingHolidayKey}
            onToggleHoliday={handleToggleHoliday}
            onSelectDay={(employeeId, dateKey) => setSelectedCell({ employeeId, dateKey })}
          />
        </>
      )
    }
    return (
      <WeeklyReportSection
        key={weekStartKey}
        weekStartKey={weekStartKey}
        rows={timesheet.rows}
        week={timesheet.week}
        isClosed={timesheet.isClosed}
        onChanged={timesheet.reload}
      />
    )
  }

  return (
    <div>
      <div className="mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Fichajes</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Control horario del personal: reloj de fábrica y fichajes desde la app.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-sm mb-lg">
        {TABS.map((item) => (
          <Button key={item.key} variant={tab === item.key ? 'primary' : 'secondary-outline'} onClick={() => updateParams({ tab: item.key })}>
            {item.label}
          </Button>
        ))}
      </div>

      {WEEK_TABS.includes(tab) && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-sm mb-md">
          <WeekPicker weekStartKey={weekStartKey} onChange={(value) => updateParams({ semana: value })}>
            {timesheet.isClosed && <StatusChip label="Cerrada" tone="success" variant="tag" />}
          </WeekPicker>
          {tab === TAB.SEMANA && (
            <div className="flex items-center gap-sm">
              <label htmlFor="week-filter" className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                Mostrar
              </label>
              <select
                id="week-filter"
                value={filter}
                onChange={(event) => updateParams({ filtro: event.target.value === WEEK_FILTER.TODOS ? null : event.target.value })}
                className="bg-surface border border-outline rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
              >
                {Object.entries(WEEK_FILTER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {WEEK_TABS.includes(tab) && renderWeekTab()}
      {tab === TAB.IMPORTAR && <ImportClockFile actorId={profile.id} onImported={timesheet.reload} />}
      {tab === TAB.FABRICA &&
        (timesheet.hasData ? (
          <FactoryLocationSettings settings={timesheet.settings} actorId={profile.id} onSaved={timesheet.reload} />
        ) : (
          <Spinner label="Cargando configuración…" />
        ))}

      <DayPunchesModal
        row={selectedRow}
        day={selectedDay}
        settings={timesheet.settings}
        weekClosed={timesheet.isClosed}
        actorId={profile.id}
        onClose={() => setSelectedCell(null)}
        onChanged={timesheet.reload}
      />
    </div>
  )
}
