import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useClients } from '../../hooks/useClients'
import { useAsync } from '../../hooks/useVisits'
import { useAnnualServiceAlerts } from '../../hooks/useAnnualServiceAlerts'
import { useFuelAlerts } from '../../hooks/useFuelAlerts'
import { countVisitsPendingReception, countVisitsPendingReview, listVisitsInRange } from '../../api/visits'
import { listHolidaysInRange } from '../../api/holidays'
import { listRepairs } from '../../api/repairs'
import { updateEquipment } from '../../api/equipment'
import { REPAIR_STATUS, ROLE_HOME_PATH, ROLES, VISIT_OCCURRENCE, isActiveClient } from '../../lib/constants'
import { FICHAJE_HABILITADO } from '../../lib/featureFlags'
import { MONTH_NAMES, getNextAnnualServiceDue, toISODateString } from '../../lib/dateUtils'
import {
  addMonths,
  buildMonthProgress,
  monthKeyOf,
  monthRange,
  progressAtWorkday,
  todayDateKey,
} from '../../features/followUp/monthProgress'
import { buildMissingDataReport } from '../../features/missingData/missingData'
import MonthProgressCard from '../../features/followUp/MonthProgressCard'
import MonthCloseCard from '../../features/followUp/MonthCloseCard'
import AtRiskEquipment from '../../features/followUp/AtRiskEquipment'
import ShortfallList from '../../features/followUp/ShortfallList'
import PendingTasks from '../../features/followUp/PendingTasks'
import AnnualServiceAlerts from '../../features/followUp/AnnualServiceAlerts'
import UpcomingAnnualServices from '../../features/followUp/UpcomingAnnualServices'
import FuelAlerts from '../../features/followUp/FuelAlerts'
import TimesheetAlerts from '../../features/followUp/TimesheetAlerts'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'
import Spinner from '../../components/ui/Spinner'

// La tarjeta con el cierre del mes anterior se ve los primeros dias habiles.
const MONTH_CLOSE_CARD_WORKDAYS = 5

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function AlertPanel({ title, children }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm">{title}</h2>
      {children}
    </section>
  )
}

// Seguimiento (pedido del 24/10/2026; reemplaza al "Panel de Control" y a
// "Resumen"): como viene el mes de visitas contra la meta, que equipos no van
// a llegar, lo que espera a cada rol y las alertas de los equipos. Con las
// flechas se ve como cerro un mes anterior. Las cuentas viven en
// features/followUp/monthProgress.js.
export default function FollowUpPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const basePath = ROLE_HOME_PATH[profile.role]
  const isSupervisor = profile.role === ROLES.SUPERVISOR

  const todayKey = todayDateKey()
  const currentMonthKey = monthKeyOf(todayKey)
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const previousMonthKey = addMonths(monthKey, -1)

  const { equipment, loading: equipmentLoading, reload: reloadEquipment } = useEquipment()
  const { clients } = useClients(!isSupervisor)
  const [historyEquipment, setHistoryEquipment] = useState(null)

  const { data: monthData, loading: monthLoading } = useAsync(async () => {
    const current = monthRange(monthKey)
    const previous = monthRange(previousMonthKey)
    const [visits, previousVisits, holidays] = await Promise.all([
      listVisitsInRange(current.start, current.end),
      listVisitsInRange(previous.start, previous.end),
      listHolidaysInRange(previous.start, current.end),
    ])
    return { visits, previousVisits, holidayKeys: holidays.map((holiday) => holiday.date) }
  }, [monthKey])

  const { data: pendingData } = useAsync(async () => {
    if (isSupervisor) {
      const [review, repairs] = await Promise.all([countVisitsPendingReview(), listRepairs()])
      return { review, repairs: repairs.filter((repair) => repair.status === REPAIR_STATUS.PENDIENTE_PRESUPUESTO).length }
    }
    return { reception: await countVisitsPendingReception() }
  }, [isSupervisor])

  // Las alertas, como antes: equipos de clientes activos.
  const alertEquipment = useMemo(() => equipment.filter((item) => isActiveClient(item.clients)), [equipment])
  const annualAlerts = useAnnualServiceAlerts(alertEquipment)
  const fuelAlerts = useFuelAlerts(alertEquipment)

  const progress = useMemo(
    () =>
      monthData &&
      buildMonthProgress({ equipment, visits: monthData.visits, holidayKeys: monthData.holidayKeys, monthKey, todayKey }),
    [equipment, monthData, monthKey, todayKey]
  )
  const previousProgress = useMemo(
    () =>
      monthData &&
      buildMonthProgress({
        equipment,
        visits: monthData.previousVisits,
        holidayKeys: monthData.holidayKeys,
        monthKey: previousMonthKey,
        todayKey,
      }),
    [equipment, monthData, previousMonthKey, todayKey]
  )
  const comparison = useMemo(
    () =>
      monthData && progress?.isCurrent
        ? progressAtWorkday({
            equipment,
            visits: monthData.previousVisits,
            holidayKeys: monthData.holidayKeys,
            monthKey: previousMonthKey,
            workdayNumber: progress.elapsedWorkdays,
          })
        : null,
    [equipment, monthData, previousMonthKey, progress]
  )
  const missingDataClients = useMemo(
    () => (isSupervisor ? null : buildMissingDataReport(clients, equipment).clientCount),
    [isSupervisor, clients, equipment]
  )

  async function muteFuelAlert(item) {
    await updateEquipment(item.id, { fuel_alert_muted_percentage: item.fuel_percentage })
    reloadEquipment()
  }

  async function muteAnnualAlert(item) {
    await updateEquipment(item.id, { annual_alert_muted_due_date: toISODateString(getNextAnnualServiceDue(item)) })
    reloadEquipment()
  }

  async function unmuteAlert(item, field) {
    await updateEquipment(item.id, { [field]: null })
    reloadEquipment()
  }

  // Lleva al calendario con el formulario de hoja de ruta abierto y el equipo
  // elegido; sin ninguna visita hecha en el mes, es la primera.
  function planEquipment(row) {
    const occurrence = row.done > 0 ? VISIT_OCCURRENCE.SEGUNDA : VISIT_OCCURRENCE.PRIMERA
    navigate(`${basePath}/calendario?planificar=${row.item.id}&visita=${occurrence}`)
  }

  const pendingItems = isSupervisor
    ? [
        { key: 'validar', label: 'Visitas por validar', value: pendingData?.review ?? null, to: `${basePath}/validacion` },
        { key: 'reparaciones', label: 'Reparaciones sin presupuesto', value: pendingData?.repairs ?? null, to: `${basePath}/reparaciones` },
      ]
    : [
        { key: 'recibir', label: 'Visitas por recibir', value: pendingData?.reception ?? null, to: `${basePath}/recepcion` },
        { key: 'datos', label: 'Clientes con datos incompletos', value: equipmentLoading ? null : missingDataClients, to: `${basePath}/datos-incompletos` },
      ]

  const showMonthClose =
    progress?.isCurrent && progress.elapsedWorkdays < MONTH_CLOSE_CARD_WORKDAYS && previousProgress?.target > 0

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Seguimiento</h1>
          {progress && !monthLoading && (
            <p className="font-body-md text-body-md text-on-surface-variant">
              {progress.isCurrent
                ? `${progress.elapsedWorkdays} de ${progress.workdayCount} días hábiles · ${progress.equipmentCount} equipos en servicio`
                : `Mes cerrado · ${progress.workdayCount} días hábiles · ${progress.equipmentCount} equipos en servicio`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-xs">
          <button
            type="button"
            onClick={() => setMonthKey(previousMonthKey)}
            aria-label="Mes anterior"
            className="w-[4rem] h-[4rem] rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[2.4rem]">chevron_left</span>
          </button>
          <p className="font-headline-md text-headline-md text-on-surface min-w-[16rem] text-center">{monthLabel(monthKey)}</p>
          <button
            type="button"
            onClick={() => setMonthKey(addMonths(monthKey, 1))}
            disabled={monthKey >= currentMonthKey}
            aria-label="Mes siguiente"
            className="w-[4rem] h-[4rem] rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <span className="material-symbols-outlined text-[2.4rem]">chevron_right</span>
          </button>
        </div>
      </div>

      {showMonthClose && <MonthCloseCard progress={previousProgress} onShow={() => setMonthKey(previousMonthKey)} />}

      {equipmentLoading || monthLoading || !progress ? (
        <Spinner label="Cargando el mes…" />
      ) : (
        <MonthProgressCard progress={progress} comparison={comparison} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md items-start">
        <div className="lg:col-span-7 min-w-0">
          {progress && !monthLoading && (progress.isCurrent ? (
            <AtRiskEquipment risk={progress.risk} onPlan={planEquipment} />
          ) : (
            <ShortfallList shortfall={progress.shortfall} />
          ))}
        </div>
        <div className="lg:col-span-5 min-w-0">
          <PendingTasks items={pendingItems} />
        </div>
      </div>

      {/* El fichaje es solo del supervisor: el administrativo no lo ve (ni tiene acceso por RLS). */}
      {FICHAJE_HABILITADO && isSupervisor && <TimesheetAlerts />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md items-start">
        <AlertPanel title="Service anual">
          <div className="max-h-[40rem] overflow-y-auto scrollbar-styled">
            <AnnualServiceAlerts
              equipment={alertEquipment}
              alerts={annualAlerts}
              onSelectEquipment={setHistoryEquipment}
              canMute={isSupervisor}
              onMute={muteAnnualAlert}
              onUnmute={(item) => unmuteAlert(item, 'annual_alert_muted_due_date')}
            />
          </div>
          <UpcomingAnnualServices equipment={alertEquipment} onSelectEquipment={setHistoryEquipment} />
        </AlertPanel>
        <AlertPanel title="Combustible">
          <div className="max-h-[40rem] overflow-y-auto scrollbar-styled">
            <FuelAlerts
              equipment={fuelAlerts.active}
              mutedEquipment={fuelAlerts.muted}
              onSelectEquipment={setHistoryEquipment}
              canMute={isSupervisor}
              onMute={muteFuelAlert}
              onUnmute={(item) => unmuteAlert(item, 'fuel_alert_muted_percentage')}
            />
          </div>
        </AlertPanel>
      </div>

      <EquipmentHistoryPanel
        equipment={historyEquipment}
        onClose={() => setHistoryEquipment(null)}
        onUpdated={(updated) => {
          setHistoryEquipment(updated)
          reloadEquipment()
        }}
        onDeleted={reloadEquipment}
      />
    </div>
  )
}
