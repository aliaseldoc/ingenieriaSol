import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useAnnualServiceAlerts } from '../../hooks/useAnnualServiceAlerts'
import { useFuelAlerts } from '../../hooks/useFuelAlerts'
import { useVisitsThisMonth } from '../../hooks/useVisits'
import { useRouteSheetsInRange } from '../../hooks/useRouteSheets'
import { useTechnicians } from '../../hooks/useTechnicians'
import { listRecentEvents } from '../../api/visitEvents'
import { updateEquipment } from '../../api/equipment'
import { CONDITION_STATUS, ROLE_HOME_PATH, ROLES, VISIT_STATUS, isActiveClient } from '../../lib/constants'
import { startOfMonth, endOfMonth, toISODateString, getNextAnnualServiceDue } from '../../lib/dateUtils'
import KpiCard from '../../components/ui/KpiCard'
import AnnualServiceAlerts from '../../features/dashboard/AnnualServiceAlerts'
import RecentActivityFeed from '../../features/dashboard/RecentActivityFeed'
import TechnicianRouteSummaryList from '../../features/dashboard/TechnicianRouteSummaryList'
import TechnicianRouteSheetsModal from '../../features/dashboard/TechnicianRouteSheetsModal'
import CompletedVisitsModal from '../../features/dashboard/CompletedVisitsModal'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'
import FuelAlerts from '../../features/dashboard/FuelAlerts'
import TimesheetAlerts from '../../features/dashboard/TimesheetAlerts'
import VisitSummaryModal from '../../features/calendar/VisitSummaryModal'
import Spinner from '../../components/ui/Spinner'

// Cada tarjeta ocupa el alto de la fila y desplaza solo su contenido, con el
// encabezado siempre visible. min-h-0 es lo que le permite achicarse por
// debajo de su contenido, condicion para que aparezca el scroll interno.
function DashboardPanel({ title, children }) {
  return (
    <div className="lg:col-span-3 flex flex-col min-h-0 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md shrink-0">
        {title}
      </h2>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-styled">{children}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { equipment, loading: equipmentLoading, reload: reloadEquipment } = useEquipment()
  // Los equipos de clientes inactivos siguen en el inventario, pero ya no se
  // atienden: no cuentan como grupos activos ni generan alertas.
  const operatingEquipment = useMemo(() => equipment.filter((item) => isActiveClient(item.clients)), [equipment])
  const alerts = useAnnualServiceAlerts(operatingEquipment)
  const fuelAlerts = useFuelAlerts(operatingEquipment)
  const { data: visitsThisMonth, loading: visitsLoading } = useVisitsThisMonth()
  const now = new Date()
  const { data: routeSheetsThisMonth, loading: routeSheetsLoading } = useRouteSheetsInRange(
    toISODateString(startOfMonth(now)),
    toISODateString(endOfMonth(now))
  )
  const { technicians, loading: techniciansLoading } = useTechnicians()
  const [recentEvents, setRecentEvents] = useState([])

  const [historyEquipment, setHistoryEquipment] = useState(null)
  const [summaryRouteSheet, setSummaryRouteSheet] = useState(null)
  const [technicianRouteSheets, setTechnicianRouteSheets] = useState(null)
  const [showCompletedVisits, setShowCompletedVisits] = useState(false)

  useEffect(() => {
    listRecentEvents(8).then(setRecentEvents)
  }, [])

  // Silenciar guarda el valor que se esta ignorando, no un booleano: la alerta
  // vuelve sola en cuanto ese valor cambie (ver 0018_silenciar_alertas.sql).
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

  if (equipmentLoading || visitsLoading || routeSheetsLoading || techniciansLoading) {
    return <Spinner label="Cargando panel…" />
  }

  const canMuteAlerts = profile?.role === ROLES.SUPERVISOR
  const activeEquipmentCount = operatingEquipment.filter((item) => item.condition_status !== CONDITION_STATUS.FUERA_SERVICIO).length
  const completedVisits = visitsThisMonth.filter((visit) => visit.status === VISIT_STATUS.APROBADA).length
  const completionPercentage = visitsThisMonth.length > 0 ? Math.round((completedVisits / visitsThisMonth.length) * 100) : 0
  // Los KPI cuentan lo mismo que muestran las listas de abajo: las alertas
  // silenciadas no suman, para que el numero grande no contradiga al panel.
  const alertCount = alerts.filter(
    (alert) => !alert.muted && (alert.alertLevel === 'vencido' || alert.alertLevel === 'proximo')
  ).length

  // En escritorio el panel ocupa exactamente el alto de la ventana menos la
  // barra superior fija (6.4rem) y el padding vertical del contenido (3.2rem
  // arriba y abajo, ver RoleLayoutShell): asi no hay scroll de pagina y cada
  // tarjeta desplaza su propio contenido. En mobile las tarjetas se apilan y
  // la pagina scrollea como siempre.
  return (
    <div className="lg:h-[calc(100vh_-_12.8rem)] lg:flex lg:flex-col lg:overflow-hidden">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs shrink-0">Resumen de Operaciones</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg shrink-0">
        Estado general de los equipos y las visitas planificadas para este mes.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-md justify-items-center shrink-0">
        <KpiCard
          icon="precision_manufacturing"
          label="Grupos Activos"
          value={activeEquipmentCount}
          sublabel={`${equipment.length} equipos en total`}
          tone="primary"
        />
        <KpiCard
          icon="fact_check"
          label="Visitas Realizadas (Mes)"
          value={`${completionPercentage}%`}
          sublabel={`${completedVisits}/${visitsThisMonth.length} visitas`}
          onClick={() => setShowCompletedVisits(true)}
          tone="secondary"
        />
        <KpiCard icon="warning" label="Alertas de Service Anual" value={alertCount} sublabel="Vencidas o próximas a vencer" tone="warning" />
        <KpiCard icon="local_gas_station" label="Alertas de Combustible" value={fuelAlerts.active.length} sublabel="Equipos con ≤ 30% de combustible" tone="soft" />
      </div>

      {/* El fichaje es solo del supervisor: el administrativo no lo ve (ni tiene acceso por RLS). */}
      {profile?.role === ROLES.SUPERVISOR && <TimesheetAlerts />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md lg:flex-1 lg:min-h-0">
        <DashboardPanel title="Actividad Reciente">
          <RecentActivityFeed events={recentEvents} onSelectEvent={(visitId) => navigate(`${ROLE_HOME_PATH[profile.role]}/visita/${visitId}`)} />
        </DashboardPanel>

        <DashboardPanel title="Hojas de Ruta por Técnico">
          <TechnicianRouteSummaryList
            technicians={technicians}
            routeSheets={routeSheetsThisMonth ?? []}
            onSelectTechnician={(technician, assigned) => setTechnicianRouteSheets({ technician, routeSheets: assigned })}
          />
        </DashboardPanel>

        <DashboardPanel title="Alertas de Service Anual">
          <AnnualServiceAlerts
            equipment={operatingEquipment}
            alerts={alerts}
            onSelectEquipment={setHistoryEquipment}
            canMute={canMuteAlerts}
            onMute={muteAnnualAlert}
            onUnmute={(item) => unmuteAlert(item, 'annual_alert_muted_due_date')}
          />
        </DashboardPanel>

        <DashboardPanel title="Alertas de Combustible">
          <FuelAlerts
            equipment={fuelAlerts.active}
            mutedEquipment={fuelAlerts.muted}
            onSelectEquipment={setHistoryEquipment}
            canMute={canMuteAlerts}
            onMute={muteFuelAlert}
            onUnmute={(item) => unmuteAlert(item, 'fuel_alert_muted_percentage')}
          />
        </DashboardPanel>
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

      <VisitSummaryModal routeSheet={summaryRouteSheet} onClose={() => setSummaryRouteSheet(null)} />

      <TechnicianRouteSheetsModal
        technician={technicianRouteSheets?.technician ?? null}
        routeSheets={technicianRouteSheets?.routeSheets ?? []}
        onClose={() => setTechnicianRouteSheets(null)}
        onSelectRouteSheet={(routeSheet) => {
          setTechnicianRouteSheets(null)
          setSummaryRouteSheet(routeSheet)
        }}
      />

      <CompletedVisitsModal
        open={showCompletedVisits}
        routeSheets={routeSheetsThisMonth ?? []}
        onClose={() => setShowCompletedVisits(false)}
        onSelectRouteSheet={(routeSheet) => {
          setShowCompletedVisits(false)
          setSummaryRouteSheet(routeSheet)
        }}
      />
    </div>
  )
}
