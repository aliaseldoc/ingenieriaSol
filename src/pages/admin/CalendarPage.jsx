import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useUnassignedRouteSheets, useRouteSheetsInRange } from '../../hooks/useRouteSheets'
import { useTechnicians } from '../../hooks/useTechnicians'
import { useVehicles } from '../../hooks/useVehicles'
import { useEquipment } from '../../hooks/useEquipment'
import { useClients } from '../../hooks/useClients'
import { rescheduleRouteSheet } from '../../api/routeSheets'
import {
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  getMonthGridWeeks,
  toISODateString,
  formatDate,
} from '../../lib/dateUtils'
import { VISIT_COLOR_CLASSES, VISIT_COLOR_LABELS, getRouteSheetColor } from '../../lib/visitColor'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import WeekCalendar from '../../features/calendar/WeekCalendar'
import MonthCalendar from '../../features/calendar/MonthCalendar'
import DayDetailModal from '../../features/calendar/DayDetailModal'
import UnassignedList from '../../features/calendar/UnassignedList'
import AssignmentPopover from '../../features/calendar/AssignmentPopover'
import RouteSheetFormModal from '../../features/calendar/RouteSheetFormModal'
import ReplicatePlanModal from '../../features/calendar/ReplicatePlanModal'
import BulkAssignModal from '../../features/calendar/BulkAssignModal'
import MonthYearPicker from '../../features/calendar/MonthYearPicker'
import VisitSummaryModal from '../../features/calendar/VisitSummaryModal'

export default function CalendarPage() {
  const { profile } = useAuth()
  const [viewMode, setViewMode] = useState('mes') // 'semana' | 'mes'
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const weekEnd = addDays(weekStart, 6)
  const monthWeeks = useMemo(() => getMonthGridWeeks(monthAnchor), [monthAnchor])
  const gridStart = monthWeeks[0][0]
  const gridEnd = monthWeeks[monthWeeks.length - 1][6]

  const rangeStart = viewMode === 'mes' ? gridStart : weekStart
  const rangeEnd = viewMode === 'mes' ? gridEnd : weekEnd

  const { data: unassignedRouteSheets, loading: unassignedLoading, reload: reloadUnassigned } = useUnassignedRouteSheets()
  const { data: rangeRouteSheets, loading: rangeLoading, reload: reloadRange } = useRouteSheetsInRange(
    toISODateString(rangeStart),
    toISODateString(rangeEnd)
  )
  const { technicians } = useTechnicians()
  const { vehicles } = useVehicles()
  const { equipment } = useEquipment()
  const { clients } = useClients()

  const [selectedRouteSheet, setSelectedRouteSheet] = useState(null)
  const [summaryRouteSheet, setSummaryRouteSheet] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  // null | { mode: 'create', initialDate } | { mode: 'edit', routeSheet }
  const [formModal, setFormModal] = useState(null)
  const [replicating, setReplicating] = useState(false)
  const [bulkAssigning, setBulkAssigning] = useState(false)

  // Solo las hojas del mes realmente visible (rangeRouteSheets en vista Mes
  // incluye dias de relleno de los meses vecinos que completan la grilla).
  const currentMonthRouteSheets = useMemo(() => {
    return (rangeRouteSheets ?? []).filter((routeSheet) => {
      if (!routeSheet.scheduled_date) return false
      const date = new Date(`${routeSheet.scheduled_date}T00:00:00`)
      return date.getFullYear() === monthAnchor.getFullYear() && date.getMonth() === monthAnchor.getMonth()
    })
  }, [rangeRouteSheets, monthAnchor])

  const selectedDateRouteSheets = useMemo(() => {
    if (!selectedDate) return []
    const dateStr = toISODateString(selectedDate)
    return (rangeRouteSheets ?? []).filter((routeSheet) => routeSheet.scheduled_date === dateStr)
  }, [selectedDate, rangeRouteSheets])

  // "Sin asignar" incluye tanto las hojas sin fecha como las que ya tienen
  // fecha pero siguen en blanco (sin tecnico) dentro del rango visible, para
  // que coincida con lo que el calendario muestra en blanco/"Sin tecnico
  // asignado" (ver lib/visitColor.js) y no contradiga al usuario.
  const sidebarRouteSheets = useMemo(() => {
    const noDate = unassignedRouteSheets ?? []
    const noTechnicianInRange = (rangeRouteSheets ?? []).filter((routeSheet) => getRouteSheetColor(routeSheet) === 'blanco')
    const seen = new Set(noDate.map((routeSheet) => routeSheet.id))
    return [...noDate, ...noTechnicianInRange.filter((routeSheet) => !seen.has(routeSheet.id))]
  }, [unassignedRouteSheets, rangeRouteSheets])

  function reloadAll() {
    reloadUnassigned()
    reloadRange()
  }

  function goToPrevious() {
    if (viewMode === 'mes') setMonthAnchor((current) => addMonths(current, -1))
    else setWeekStart((current) => addDays(current, -7))
  }

  function goToNext() {
    if (viewMode === 'mes') setMonthAnchor((current) => addMonths(current, 1))
    else setWeekStart((current) => addDays(current, 7))
  }

  function goToToday() {
    const today = new Date()
    if (viewMode === 'mes') setMonthAnchor(startOfMonth(today))
    else setWeekStart(startOfWeek(today))
    setSelectedDate(today)
  }

  async function handleDropRouteSheet(routeSheetId, dateStr) {
    const routeSheet = [...(unassignedRouteSheets ?? []), ...(rangeRouteSheets ?? [])].find((item) => item.id === routeSheetId)
    await rescheduleRouteSheet(routeSheetId, dateStr, routeSheet?.scheduled_time_start?.slice(0, 5) ?? '09:00')
    reloadAll()
  }

  if (unassignedLoading || rangeLoading) return <Spinner label="Cargando calendario…" />

  // Semana ocupa justo el alto disponible y cada dia scrollea por dentro.
  // Mes ocupa como minimo ese alto: si sus filas necesitan mas (meses de 6
  // semanas, dias cargados o pantallas bajas) el calendario crece sin
  // recortarse ni scrollear internamente (ver MonthCalendar.jsx) y es la
  // PAGINA la que scrollea — por eso en Mes el alto es minimo y aca NO hay
  // overflow-hidden.
  // El aside de "Hojas de Ruta Sin Asignar" iguala siempre el alto del
  // calendario, sin JS: con contain:size su lista no le suma alto a la fila,
  // asi la fila mide lo que el calendario y el "stretch" por defecto de
  // flexbox estira el aside a ese alto. La lista scrollea por dentro.
  // 12.8rem = 6.4rem del TopBar + 3.2rem+3.2rem del padding del <main> (ver
  // RoleLayoutShell.jsx), no un numero adivinado.
  return (
    <div className={`flex flex-col ${viewMode === 'mes' ? 'lg:min-h-[calc(100vh-12.8rem)]' : 'lg:h-[calc(100vh-12.8rem)]'}`}>
      <div className="shrink-0 flex flex-col gap-sm mb-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Planificación de Rutas</h1>
          {viewMode === 'semana' && (
            <p className="font-body-md text-body-md text-on-surface-variant">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="flex flex-wrap items-center gap-sm">
            <Button variant={viewMode === 'mes' ? 'primary' : 'secondary-outline'} onClick={() => setViewMode('mes')}>
              Mes
            </Button>
            <Button variant={viewMode === 'semana' ? 'primary' : 'secondary-outline'} onClick={() => setViewMode('semana')}>
              Semana
            </Button>
            <Button variant="secondary-outline" onClick={goToToday}>Hoy</Button>
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            {viewMode === 'mes' && (
              <Button
                variant="secondary-outline"
                icon="content_copy"
                disabled={currentMonthRouteSheets.length === 0}
                onClick={() => setReplicating(true)}
              >
                Replicar Planificación al Mes Siguiente
              </Button>
            )}
            <Button variant="primary" icon="add" onClick={() => setFormModal({ mode: 'create', initialDate: null })}>
              Nueva Hoja de Ruta
            </Button>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap gap-md mb-md">
        {Object.entries(VISIT_COLOR_LABELS).map(([color, label]) => (
          <div key={color} className="flex items-center gap-xs">
            <span className={`w-md h-md rounded-full border ${VISIT_COLOR_CLASSES[color]}`} />
            <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-md flex-1 lg:min-h-0">
        <aside className="order-2 lg:order-1 lg:w-[28rem] shrink-0 max-h-[24rem] lg:max-h-none min-h-0 overflow-hidden lg:pr-xs lg:[contain:size] flex flex-col">
          <UnassignedList
            routeSheets={sidebarRouteSheets}
            onSelectRouteSheet={setSelectedRouteSheet}
            onOpenBulkAssign={() => setBulkAssigning(true)}
          />
        </aside>

        <div className="order-1 lg:order-2 flex-1 min-w-0 flex flex-col lg:min-h-0">
          <div className="shrink-0 flex items-center justify-between mb-sm">
            <Button variant="secondary-outline" icon="chevron_left" onClick={goToPrevious} aria-label="Anterior" />
            <MonthYearPicker
              monthAnchor={viewMode === 'mes' ? monthAnchor : weekStart}
              onSelect={(date) => (viewMode === 'mes' ? setMonthAnchor(date) : setWeekStart(startOfWeek(date)))}
            />
            <Button variant="secondary-outline" icon="chevron_right" onClick={goToNext} aria-label="Siguiente" />
          </div>
          <div className="lg:flex-1 lg:min-h-0">
            {viewMode === 'mes' ? (
              <MonthCalendar
                monthAnchor={monthAnchor}
                weeks={monthWeeks}
                routeSheets={rangeRouteSheets ?? []}
                onSelectDay={setSelectedDate}
              />
            ) : (
              <WeekCalendar
                weekStart={weekStart}
                routeSheets={rangeRouteSheets ?? []}
                onSelectRouteSheet={setSelectedRouteSheet}
                onDropRouteSheet={handleDropRouteSheet}
                onSelectDay={setSelectedDate}
              />
            )}
          </div>
        </div>
      </div>

      <DayDetailModal
        date={selectedDate}
        routeSheets={selectedDateRouteSheets}
        onClose={() => setSelectedDate(null)}
        onSelectRouteSheet={(routeSheet) => {
          setSelectedDate(null)
          setSummaryRouteSheet(routeSheet)
        }}
        onNewRouteSheet={(date) => {
          setSelectedDate(null)
          setFormModal({ mode: 'create', initialDate: toISODateString(date) })
        }}
      />

      <VisitSummaryModal
        routeSheet={summaryRouteSheet}
        onClose={() => setSummaryRouteSheet(null)}
        onAssign={(routeSheet) => {
          setSummaryRouteSheet(null)
          setSelectedRouteSheet(routeSheet)
        }}
        onEdit={(routeSheet) => {
          setSummaryRouteSheet(null)
          setFormModal({ mode: 'edit', routeSheet })
        }}
      />

      <AssignmentPopover
        routeSheet={selectedRouteSheet}
        technicians={technicians}
        vehicles={vehicles}
        onClose={() => setSelectedRouteSheet(null)}
        onSaved={() => {
          setSelectedRouteSheet(null)
          reloadAll()
        }}
      />

      <RouteSheetFormModal
        open={Boolean(formModal)}
        mode={formModal?.mode ?? 'create'}
        routeSheet={formModal?.mode === 'edit' ? formModal.routeSheet : null}
        clients={clients}
        equipment={equipment}
        createdBy={profile.id}
        initialDate={formModal?.mode === 'create' ? formModal.initialDate : null}
        onClose={() => setFormModal(null)}
        onSaved={() => {
          setFormModal(null)
          reloadAll()
        }}
        onDeleted={() => {
          setFormModal(null)
          reloadAll()
        }}
      />

      <ReplicatePlanModal
        open={replicating}
        routeSheets={currentMonthRouteSheets}
        createdBy={profile.id}
        onClose={() => setReplicating(false)}
        onReplicated={() => {
          setReplicating(false)
          reloadAll()
        }}
      />

      <BulkAssignModal
        open={bulkAssigning}
        routeSheets={sidebarRouteSheets}
        technicians={technicians}
        vehicles={vehicles}
        onClose={() => setBulkAssigning(false)}
        onSaved={() => {
          setBulkAssigning(false)
          reloadAll()
        }}
      />
    </div>
  )
}
