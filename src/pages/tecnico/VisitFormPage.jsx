import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useVisitDetail, useVisitParameters, useVisitEvents } from '../../hooks/useVisits'
import { saveVisitOrQueue, getPendingWriteForVisit } from '../../offline/syncQueue'
import { getEquipmentById } from '../../api/equipment'
import {
  CHECKLIST_CATEGORY,
  CHECKLIST_ITEM_STATUS,
  SERVICE_TYPE,
  TECHNICIAN_EDITABLE_STATUSES,
  VISIT_CHECKLIST_ITEMS,
  VISIT_CHANGES_FIELDS,
} from '../../lib/constants'
import Button from '../../components/ui/Button'
import DraggableFab from '../../components/ui/DraggableFab'
import Spinner from '../../components/ui/Spinner'
import VisitDetailPanel from '../../features/visitReview/VisitDetailPanel'
import VisitMetadataCard from '../../features/visitForm/VisitMetadataCard'
import VisitChecklistSection from '../../features/visitForm/VisitChecklistSection'
import VisitParametersForm from '../../features/visitForm/VisitParametersForm'
import VisitChangesSection from '../../features/visitForm/VisitChangesSection'
import VisitObservationsSection from '../../features/visitForm/VisitObservationsSection'
import EquipmentHistoryPanel from '../../features/equipmentInventory/EquipmentHistoryPanel'

export default function VisitFormPage() {
  const { visitId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const { data: visit, loading: visitLoading } = useVisitDetail(visitId)
  const { data: existingParameters } = useVisitParameters(visitId)
  const { data: events } = useVisitEvents(visitId)

  const [serviceType, setServiceType] = useState(SERVICE_TYPE.PREVENTIVO)
  const [checklistData, setChecklistData] = useState({})
  const [changesData, setChangesData] = useState({})
  const [parameterValues, setParameterValues] = useState({})
  const [notes, setNotes] = useState('')
  const [faultReported, setFaultReported] = useState(false)
  const [faultDescription, setFaultDescription] = useState('')
  const [technicianSignature, setTechnicianSignature] = useState(null)
  const [technicianSignatureAt, setTechnicianSignatureAt] = useState(null)
  const [technicianSignatureName, setTechnicianSignatureName] = useState('')
  const [clientSignature, setClientSignature] = useState(null)
  const [clientSignatureAt, setClientSignatureAt] = useState(null)
  const [clientSignatureName, setClientSignatureName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [initialized, setInitialized] = useState(false)
  // undefined = todavia no se reviso IndexedDB; null = no hay nada pendiente.
  const [pendingWrite, setPendingWrite] = useState(undefined)
  const [equipmentDetail, setEquipmentDetail] = useState(null)
  const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false)

  async function handleShowEquipmentDetail() {
    setLoadingEquipmentDetail(true)
    try {
      setEquipmentDetail(await getEquipmentById(visit.equipment_id))
    } finally {
      setLoadingEquipmentDetail(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (visitId) {
      getPendingWriteForVisit(visitId).then((entry) => {
        if (!cancelled) setPendingWrite(entry ?? null)
      })
    }
    return () => {
      cancelled = true
    }
  }, [visitId])

  function applyFormValues({
    serviceType: nextServiceType,
    checklistData: nextChecklistData,
    changesData: nextChangesData,
    notes: nextNotes,
    faultReported: nextFaultReported,
    faultDescription: nextFaultDescription,
    technicianSignature: nextTechnicianSignature,
    technicianSignatureAt: nextTechnicianSignatureAt,
    technicianSignatureName: nextTechnicianSignatureName,
    clientSignature: nextClientSignature,
    clientSignatureAt: nextClientSignatureAt,
    clientSignatureName: nextClientSignatureName,
  }) {
    setServiceType(nextServiceType ?? SERVICE_TYPE.PREVENTIVO)
    const defaultChecklistData = Object.fromEntries(
      VISIT_CHECKLIST_ITEMS.map((item) => [item.key, CHECKLIST_ITEM_STATUS.OK])
    )
    setChecklistData({ ...defaultChecklistData, ...(nextChecklistData ?? {}) })
    const defaultChangesData = Object.fromEntries(VISIT_CHANGES_FIELDS.map((field) => [field.key, field.defaultValue]))
    setChangesData({ ...defaultChangesData, ...(nextChangesData ?? {}) })
    setNotes(nextNotes ?? '')
    setFaultReported(nextFaultReported ?? false)
    setFaultDescription(nextFaultDescription ?? '')
    setTechnicianSignature(nextTechnicianSignature ?? null)
    setTechnicianSignatureAt(nextTechnicianSignatureAt ?? null)
    setTechnicianSignatureName(nextTechnicianSignatureName ?? '')
    setClientSignature(nextClientSignature ?? null)
    setClientSignatureAt(nextClientSignatureAt ?? null)
    setClientSignatureName(nextClientSignatureName ?? '')
  }

  // Si hay una escritura encolada para esta visita, es mas nueva que
  // cualquier dato del servidor (o del cache de lectura) y siempre gana al
  // sembrar el formulario.
  useEffect(() => {
    if (initialized || pendingWrite === undefined) return
    if (pendingWrite) {
      applyFormValues(pendingWrite.formSnapshot)
      setParameterValues(pendingWrite.parameterValues ?? {})
      setInitialized(true)
      return
    }
    if (!visit) return
    applyFormValues({
      serviceType: visit.service_type,
      checklistData: visit.checklist_data,
      changesData: visit.changes_data,
      notes: visit.notes,
      faultReported: visit.fault_reported,
      faultDescription: visit.fault_description,
      technicianSignature: visit.technician_signature,
      technicianSignatureAt: visit.technician_signature_at,
      technicianSignatureName: visit.technician_signature_name,
      clientSignature: visit.client_signature,
      clientSignatureAt: visit.client_signature_at,
      clientSignatureName: visit.client_signature_name,
    })
    setInitialized(true)
  }, [visit, pendingWrite, initialized])

  function handleChangeTechnicianSignature(dataUrl) {
    setTechnicianSignature(dataUrl)
    setTechnicianSignatureAt(dataUrl ? new Date().toISOString() : null)
  }

  function handleChangeClientSignature(dataUrl) {
    setClientSignature(dataUrl)
    setClientSignatureAt(dataUrl ? new Date().toISOString() : null)
  }

  function handleChangeParameter(key, value) {
    setParameterValues((values) => {
      const next = { ...values, [key]: value }
      const tankSize = Number(visit?.equipment?.fuel_capacity)
      if (key === 'combustible_litros' && value !== '' && tankSize > 0) {
        next.nivel_combustible = String(Math.round((Number(value) / tankSize) * 100))
      }
      if (key === 'nivel_combustible' && value !== '' && tankSize > 0) {
        next.combustible_litros = String(Math.round((tankSize * Number(value)) / 100))
      }
      return next
    })
  }

  useEffect(() => {
    // Si hay una escritura pendiente, applyFormValues + setParameterValues
    // de arriba ya dejaron el formulario en el estado correcto; no
    // corresponde mezclar valores del servidor/cache encima.
    if (!existingParameters || pendingWrite) return
    const values = {}
    for (const parameter of existingParameters) values[parameter.metric_key] = String(parameter.value)
    setParameterValues((current) => ({ ...values, ...current }))
  }, [existingParameters, pendingWrite])

  if (visitLoading || !visit || pendingWrite === undefined) return <Spinner label="Cargando visita…" />

  if (!TECHNICIAN_EDITABLE_STATUSES.includes(visit.status)) {
    return (
      <div>
        <div className="flex items-center justify-between gap-sm mb-lg">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Detalle de Visita</h1>
          <Button variant="secondary-outline" icon="arrow_back" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
        <VisitDetailPanel
          visit={visit}
          parameters={existingParameters ?? []}
          events={events ?? []}
          actions={
            <Button
              variant="secondary-outline"
              icon="precision_manufacturing"
              onClick={handleShowEquipmentDetail}
              disabled={loadingEquipmentDetail}
            >
              {loadingEquipmentDetail ? 'Cargando…' : 'Ver Ficha Técnica'}
            </Button>
          }
        />
        <EquipmentHistoryPanel
          equipment={equipmentDetail}
          onClose={() => setEquipmentDetail(null)}
          onUpdated={setEquipmentDetail}
          onDeleted={() => setEquipmentDetail(null)}
        />
      </div>
    )
  }

  const formSnapshot = {
    serviceType,
    checklistData,
    changesData,
    notes,
    faultReported,
    faultDescription,
    technicianSignature,
    technicianSignatureAt,
    technicianSignatureName,
    clientSignature,
    clientSignatureAt,
    clientSignatureName,
  }

  async function handleSaveDraft() {
    setSaving(true)
    setSaveStatus(null)
    setSaveError(null)
    try {
      const result = await saveVisitOrQueue({
        visitId,
        kind: 'draft',
        formSnapshot,
        parameterValues,
        actorId: profile.id,
        equipment: visit.equipment,
      })
      setSaveStatus(result.queued ? 'saved-offline' : 'saved-online')
    } catch (error) {
      setSaveStatus('error')
      setSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setSaveStatus(null)
    setSaveError(null)
    try {
      await saveVisitOrQueue({
        visitId,
        kind: 'submit',
        formSnapshot,
        parameterValues,
        actorId: profile.id,
        equipment: visit.equipment,
      })
      navigate('/tecnico', { replace: true })
    } catch (error) {
      setSaveStatus('error')
      setSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Informe de Visita de Servicio</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {visit.equipment?.motor} · {visit.equipment?.clients?.name}
          </p>
        </div>

        <VisitMetadataCard visit={visit} serviceType={serviceType} onChangeServiceType={setServiceType} />

        <VisitChecklistSection
          category={CHECKLIST_CATEGORY.EQUIPO_PARADO}
          checklistData={checklistData}
          onChangeItem={(key, value) => setChecklistData((data) => ({ ...data, [key]: value }))}
          equipment={visit.equipment}
        />

        <VisitParametersForm parameterValues={parameterValues} onChangeParameter={handleChangeParameter} equipment={visit.equipment} />

        <VisitChecklistSection
          category={CHECKLIST_CATEGORY.EQUIPO_MARCHA}
          checklistData={checklistData}
          onChangeItem={(key, value) => setChecklistData((data) => ({ ...data, [key]: value }))}
          equipment={visit.equipment}
        />

        <VisitChangesSection
          changesData={changesData}
          onChangeField={(key, value) => setChangesData((data) => ({ ...data, [key]: value }))}
        />

        <VisitObservationsSection
          notes={notes}
          onChangeNotes={setNotes}
          faultReported={faultReported}
          onToggleFaultReported={setFaultReported}
          faultDescription={faultDescription}
          onChangeFaultDescription={setFaultDescription}
          technicianSignature={technicianSignature}
          onChangeTechnicianSignature={handleChangeTechnicianSignature}
          technicianSignatureName={technicianSignatureName}
          onChangeTechnicianSignatureName={setTechnicianSignatureName}
          clientSignature={clientSignature}
          onChangeClientSignature={handleChangeClientSignature}
          clientSignatureName={clientSignatureName}
          onChangeClientSignatureName={setClientSignatureName}
        />

        <div className="flex flex-col items-end gap-sm">
          {saveStatus === 'saved-online' && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Borrador guardado.</p>
          )}
          {saveStatus === 'saved-offline' && (
            <p className="font-body-sm text-body-sm text-warning">
              Guardado en el dispositivo. Se enviará cuando vuelvas a tener conexión.
            </p>
          )}
          {saveStatus === 'error' && (
            <p className="font-body-sm text-body-sm text-error">
              No se pudo guardar: {saveError?.message ?? 'error desconocido'}.
            </p>
          )}
          <div className="flex justify-end gap-sm">
            <Button type="submit" variant="primary" disabled={saving}>
              Finalizar Reporte
            </Button>
          </div>
        </div>
      </form>

      <DraggableFab onClick={handleSaveDraft} disabled={saving} label="Guardar Borrador" icon="save" />
    </div>
  )
}
