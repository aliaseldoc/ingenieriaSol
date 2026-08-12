import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEquipment } from '../../hooks/useEquipment'
import { useAnnualServiceAlerts } from '../../hooks/useAnnualServiceAlerts'
import { useFuelAlerts } from '../../hooks/useFuelAlerts'
import { useVisitsThisMonth } from '../../hooks/useVisits'
import { useRouteSheetsInRange } from '../../hooks/useRouteSheets'
import { useTechnicians } from '../../hooks/useTechnicians'
import { listRecentEvents } from '../../api/visitEvents'
import { CONDITION_STATUS, ROLE_HOME_PATH, VISIT_STATUS } from '../../lib/constants'
import { startOfMonth, endOfMonth, toISODateString } from '../../lib/dateUtils'
import KpiCard from '../../components/ui/KpiCard'
import AnnualServiceAlerts from '../../features/dashboard/AnnualServiceAlerts'
import RecentActivityFeed from '../../features/dashboard/RecentActivityFeed'
import TechnicianRouteSummaryList from '../../features/dashboard/TechnicianRouteSummaryList'
import TechnicianRouteSheetsModal from '../../features/dashboard/TechnicianRouteSheetsModal'
import CompletedVisitsModal from '../../features/dashboard/CompletedVisitsModal'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'
import FuelAlerts from '../../features/dashboard/FuelAlerts'
import VisitSummaryModal from '../../features/calendar/VisitSummaryModal'
import Spinner from '../../components/ui/Spinner'

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { equipment, loading: equipmentLoading, reload: reloadEquipment } = useEquipment()
  const alerts = useAnnualServiceAlerts(equipment)
  const fuelAlerts = useFuelAlerts(equipment)
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

  if (equipmentLoading || visitsLoading || routeSheetsLoading || techniciansLoading) {
    return <Spinner label="Cargando panel…" />
  }

  const activeEquipmentCount = equipment.filter((item) => item.condition_status !== CONDITION_STATUS.FUERA_SERVICIO).length
  const completedVisits = visitsThisMonth.filter((visit) => visit.status === VISIT_STATUS.APROBADA).length
  const completionPercentage = visitsThisMonth.length > 0 ? Math.round((completedVisits / visitsThisMonth.length) * 100) : 0
  const alertCount = alerts.filter((alert) => alert.alertLevel === 'vencido' || alert.alertLevel === 'proximo').length

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Resumen de Operaciones</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        Estado general de los equipos y las visitas planificadas para este mes.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-md justify-items-center">
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
        <KpiCard icon="local_gas_station" label="Alertas de Combustible" value={fuelAlerts.length} sublabel="Equipos con ≤ 30% de combustible" tone="soft" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md">
            Actividad Reciente
          </h2>
          <RecentActivityFeed events={recentEvents} onSelectEvent={(visitId) => navigate(`${ROLE_HOME_PATH[profile.role]}/visita/${visitId}`)} />
        </div>

        <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md">
            Hojas de Ruta por Técnico
          </h2>
          <TechnicianRouteSummaryList
            technicians={technicians}
            routeSheets={routeSheetsThisMonth ?? []}
            onSelectTechnician={(technician, assigned) => setTechnicianRouteSheets({ technician, routeSheets: assigned })}
          />
        </div>

        <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md">
            Alertas de Service Anual
          </h2>
          <AnnualServiceAlerts equipment={equipment} alerts={alerts} onSelectEquipment={setHistoryEquipment} />
        </div>

        <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide p-md">
            Alertas de Combustible
          </h2>
          <FuelAlerts equipment={fuelAlerts} onSelectEquipment={setHistoryEquipment} />
        </div>
      </div>

      <EquipmentHistoryPanel
        equipment={historyEquipment}
        onClose={() => setHistoryEquipment(null)}
        onUpdated={(updated) => {
          setHistoryEquipment(updated)
          reloadEquipment()
        }}
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
