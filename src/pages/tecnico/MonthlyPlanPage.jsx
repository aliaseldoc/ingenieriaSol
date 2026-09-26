import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTechnicianVisits } from '../../hooks/useVisits'
import { listVisitsForTechnician, listVisitParametersForVisits, createUnplannedVisit } from '../../api/visits'
import { SERVICE_TYPE_LABELS, VISIT_STATUS, VISIT_STATUS_LABELS } from '../../lib/constants'
import { formatFullDate, formatDateTime } from '../../lib/dateUtils'
import { useConnectivityStatus, usePendingVisitIds } from '../../offline/useOfflineSync'
import {
  saveRouteSheetToCache,
  saveAllVisitParametersToCache,
  recordRouteSheetDownload,
  getLastDownloadInfo,
  getDownloadedVisitIds,
} from '../../offline/routeSheetCache'
import StatusChip from '../../components/ui/StatusChip'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import NewReportModal from '../../features/visitForm/NewReportModal'
import { useSupervisorNotes } from '../../features/supervisorNotes/SupervisorNotesContext'

const STATUS_TONE = {
  [VISIT_STATUS.APROBADA]: 'success',
  [VISIT_STATUS.RECHAZADA]: 'error',
  [VISIT_STATUS.ENVIADA]: 'warning',
  [VISIT_STATUS.REVISION_SOLICITADA]: 'warning',
  [VISIT_STATUS.PLANIFICADA]: 'neutral',
  [VISIT_STATUS.BORRADOR]: 'neutral',
}

// Ya validadas (aprobada o rechazada): pasan a "Mi Historial", no tiene
// sentido seguir mostrandolas como pendientes en el plan mensual.
const VALIDATED_STATUSES = [VISIT_STATUS.APROBADA, VISIT_STATUS.RECHAZADA]

function clientGroupKey(section, dateKey, clientId) {
  return `${section}::${dateKey}::${clientId}`
}

function groupVisitsByDateAndClient(visits) {
  const dateGroups = new Map()
  for (const visit of visits) {
    const dateKey = visit.scheduled_date ?? 'sin-fecha'
    if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, new Map())
    const clientGroups = dateGroups.get(dateKey)
    const clientId = visit.equipment?.client_id ?? 'sin-cliente'
    if (!clientGroups.has(clientId)) {
      clientGroups.set(clientId, { clientId, clientName: visit.equipment?.clients?.name ?? 'Sin cliente asignado', visits: [] })
    }
    clientGroups.get(clientId).visits.push(visit)
  }

  return Array.from(dateGroups.entries())
    .sort(([a], [b]) => {
      if (a === 'sin-fecha') return 1
      if (b === 'sin-fecha') return -1
      return a.localeCompare(b)
    })
    .map(([dateKey, clientGroups]) => ({
      dateKey,
      clientGroups: Array.from(clientGroups.values()).sort((a, b) => a.clientName.localeCompare(b.clientName)),
    }))
}

function DateGroupList({
  section,
  dateGroups,
  expandedGroupKeys,
  onToggleGroup,
  onSelectVisit,
  pendingVisitIds,
  downloadedVisitIds,
  unreadNoteVisitIds,
}) {
  return (
    <div className="space-y-lg">
      {dateGroups.map(({ dateKey, clientGroups }) => {
        const visitsInDay = clientGroups.flatMap((group) => group.visits)
        const dayAvailableOffline = visitsInDay.length > 0 && visitsInDay.every((visit) => downloadedVisitIds.has(visit.id))

        return (
          <div key={dateKey}>
            <h3 className="list-title-bar font-label-md text-label-md uppercase tracking-wide mb-sm px-md py-sm rounded flex items-center gap-xs">
              {dateKey === 'sin-fecha' ? 'Sin fecha asignada' : formatFullDate(dateKey)}
              {dayAvailableOffline && (
                <span
                  className="material-symbols-outlined text-[1.6rem]"
                  aria-label="Disponible sin conexión"
                  title="Disponible sin conexión"
                >
                  cloud_done
                </span>
              )}
            </h3>
            <div className="space-y-sm">
              {clientGroups.map((group) => {
                const key = clientGroupKey(section, dateKey, group.clientId)
                const expanded = expandedGroupKeys.has(key)
                // Los grupos arrancan contraidos: el aviso tiene que verse
                // tambien en el encabezado del cliente.
                const hasUnreadNotes = group.visits.some((visit) => unreadNoteVisitIds.has(visit.id))
                return (
                  <div key={key} className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest">
                    <button
                      type="button"
                      onClick={() => onToggleGroup(key)}
                      className="w-full flex items-center gap-sm py-sm px-md bg-secondary hover:bg-secondary-container transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[2rem] text-secondary-fixed-dim">
                        {expanded ? 'expand_more' : 'chevron_right'}
                      </span>
                      <span className="flex-1 font-label-md text-label-md text-on-secondary">{group.clientName}</span>
                      {hasUnreadNotes && <StatusChip label="Nota nueva" tone="error" variant="tag" />}
                      <span className="font-label-sm text-label-sm text-secondary-fixed-dim">({group.visits.length})</span>
                    </button>
                    {expanded && (
                      <div className="p-sm space-y-sm">
                        {group.visits.map((visit) => (
                          <button
                            key={visit.id}
                            type="button"
                            onClick={() => onSelectVisit(visit.id)}
                            className="w-full text-left border border-outline-variant rounded-lg p-md hover:border-secondary transition-colors flex items-center justify-between gap-sm"
                          >
                            <div>
                              <p className="font-label-md text-label-md text-on-surface">{visit.equipment?.motor}</p>
                              <p className="font-body-sm text-body-sm text-on-surface-variant">
                                {SERVICE_TYPE_LABELS[visit.service_type] ?? 'Sin tipo'}
                              </p>
                              {unreadNoteVisitIds.has(visit.id) && (
                                <div className="mt-xs">
                                  <StatusChip label="Nota nueva" tone="error" variant="tag" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-sm">
                              {visit.scheduled_time_start && (
                                <span className="font-label-sm text-label-sm text-on-surface-variant">
                                  {visit.scheduled_time_start.slice(0, 5)}
                                </span>
                              )}
                              {pendingVisitIds.has(visit.id) && (
                                <StatusChip label="Sin sincronizar" tone="warning" variant="tag" />
                              )}
                              <StatusChip label={VISIT_STATUS_LABELS[visit.status]} tone={STATUS_TONE[visit.status]} variant="tag" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function MonthlyPlanPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data: visits, loading, reload } = useTechnicianVisits(profile?.id)
  const online = useConnectivityStatus()
  const pendingVisitIds = usePendingVisitIds()
  const { unreadVisitIds } = useSupervisorNotes()
  // Vacio por defecto = todos los grupos de cliente arrancan contraidos.
  const [expandedGroupKeys, setExpandedGroupKeys] = useState(() => new Set())
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)
  const [downloadInfo, setDownloadInfo] = useState(null)
  const [downloadedVisitIds, setDownloadedVisitIds] = useState(() => new Set())
  const [showNewReport, setShowNewReport] = useState(false)

  async function refreshDownloadedVisitIds() {
    const ids = await getDownloadedVisitIds()
    setDownloadedVisitIds(new Set(ids))
  }

  useEffect(() => {
    getLastDownloadInfo().then(setDownloadInfo)
    refreshDownloadedVisitIds()
  }, [])

  async function handleDownloadRouteSheet() {
    setDownloading(true)
    setDownloadError(null)
    try {
      // saveRouteSheetToCache descarta el historial ya validado y devuelve
      // solo las visitas pendientes: los parametros y el contador se arman
      // sobre esas, no sobre todo lo que trajo el servidor.
      const freshVisits = await listVisitsForTechnician(profile.id)
      const cachedVisits = await saveRouteSheetToCache(profile.id, freshVisits)
      const visitIds = cachedVisits.map((visit) => visit.id)
      const parameterRows = await listVisitParametersForVisits(visitIds)
      await saveAllVisitParametersToCache(visitIds, parameterRows)
      await recordRouteSheetDownload(profile.id, cachedVisits.length)
      setDownloadInfo(await getLastDownloadInfo())
      await refreshDownloadedVisitIds()
      await reload()
    } catch (error) {
      setDownloadError(error)
    } finally {
      setDownloading(false)
    }
  }

  const plannedGroups = useMemo(
    () =>
      groupVisitsByDateAndClient(
        (visits ?? []).filter(
          (visit) => !VALIDATED_STATUSES.includes(visit.status) && visit.status !== VISIT_STATUS.ENVIADA
        )
      ),
    [visits]
  )

  const pendingValidationGroups = useMemo(
    () => groupVisitsByDateAndClient((visits ?? []).filter((visit) => visit.status === VISIT_STATUS.ENVIADA)),
    [visits]
  )

  function toggleGroupExpanded(key) {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function goToVisit(visitId) {
    navigate(`/tecnico/visita/${visitId}`)
  }

  async function handleCreateReport(equipmentId) {
    const visitId = await createUnplannedVisit(equipmentId, profile.id)
    goToVisit(visitId)
  }

  if (loading) return <Spinner label="Cargando tu plan…" />

  const isEmpty = plannedGroups.length === 0 && pendingValidationGroups.length === 0

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-sm mb-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Mi Plan Mensual</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Visitas asignadas por el administrativo.</p>
        </div>
        {/* En mobile los dos botones se apilan (Generar Reporte queda debajo
            del de descarga); en escritorio van uno al lado del otro. */}
        <div className="flex flex-col md:flex-row gap-sm">
          <Button
            variant="secondary-outline"
            icon="download"
            disabled={!online || downloading}
            onClick={handleDownloadRouteSheet}
          >
            {downloading ? 'Descargando…' : 'Descargar hoja de ruta'}
          </Button>
          {/* Generar el reporte necesita el listado de clientes/equipos y un
              insert contra el servidor: sin conexion no puede funcionar. */}
          <Button variant="primary" icon="post_add" disabled={!online} onClick={() => setShowNewReport(true)}>
            Generar Reporte
          </Button>
        </div>
      </div>

      <div className="mb-lg">
        {downloadInfo ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Última descarga: {formatDateTime(downloadInfo.downloadedAt)} · {downloadInfo.count} visitas
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Todavía no descargaste la hoja de ruta para trabajar sin conexión.
          </p>
        )}
        {downloadError && (
          <p className="font-body-sm text-body-sm text-error mt-xs">
            No se pudo descargar la hoja de ruta. Intentá de nuevo cuando tengas conexión.
          </p>
        )}
      </div>

      {isEmpty ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
          <EmptyState icon="event_busy" title="Sin visitas asignadas" description="Todavía no tenés visitas planificadas." />
        </div>
      ) : (
        <>
          {plannedGroups.length > 0 && (
            <DateGroupList
              section="planificado"
              dateGroups={plannedGroups}
              expandedGroupKeys={expandedGroupKeys}
              onToggleGroup={toggleGroupExpanded}
              onSelectVisit={goToVisit}
              pendingVisitIds={pendingVisitIds}
              downloadedVisitIds={downloadedVisitIds}
              unreadNoteVisitIds={unreadVisitIds}
            />
          )}

          {pendingValidationGroups.length > 0 && (
            <div className={plannedGroups.length > 0 ? 'mt-xl pt-lg border-t border-outline-variant' : undefined}>
              <h2 className="list-title-bar font-headline-md text-headline-md mb-md px-md py-sm rounded">
                Pendiente de Validación
              </h2>
              <DateGroupList
                section="pendiente"
                dateGroups={pendingValidationGroups}
                expandedGroupKeys={expandedGroupKeys}
                onToggleGroup={toggleGroupExpanded}
                onSelectVisit={goToVisit}
                pendingVisitIds={pendingVisitIds}
                downloadedVisitIds={downloadedVisitIds}
                unreadNoteVisitIds={unreadVisitIds}
              />
            </div>
          )}
        </>
      )}

      {/* Montado solo al abrirse: adentro pide clientes y equipos al servidor,
          y no tiene sentido pagar esas dos consultas en cada carga del plan. */}
      {showNewReport && (
        <NewReportModal open onClose={() => setShowNewReport(false)} onConfirm={handleCreateReport} />
      )}
    </div>
  )
}
