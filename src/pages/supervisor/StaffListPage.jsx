import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listStaff, setProfileActive } from '../../api/profiles'
import { createVehicle, setVehicleActive, deleteVehicle } from '../../api/vehicles'
import { listEmployees, setEmployeeActive } from '../../api/employees'
import { useAllVehicles } from '../../hooks/useVehicles'
import { ROLE_LABELS } from '../../lib/constants'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import FormSection from '../../components/ui/FormSection'
import Field from '../../components/ui/Field'
import StatusChip from '../../components/ui/StatusChip'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import StaffDetailPanel from '../../features/staff/StaffDetailPanel'
import VehicleDetailPanel from '../../features/staff/VehicleDetailPanel'
import FactoryEmployeeModal from '../../features/staff/FactoryEmployeeModal'

const ROLE_TONE = { administrativo: 'neutral', tecnico: 'success', supervisor: 'warning' }
const EMPTY_VEHICLE_FORM = { plate: '', name: '' }

const TAB = {
  PERSONAL: 'personal',
  FABRICA: 'fabrica',
  VEHICULOS: 'vehiculos',
}

export default function StaffListPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(TAB.PERSONAL)
  const [staff, setStaff] = useState(null)
  const [detailStaff, setDetailStaff] = useState(null)
  // Empleados de fabrica: legajos de fichaje sin usuario (ver FICHAJE.md).
  const [factoryEmployees, setFactoryEmployees] = useState(null)
  const [employeeModal, setEmployeeModal] = useState(null) // { employee } (null = alta)
  const { vehicles, loading: vehiclesLoading, reload: reloadVehicles } = useAllVehicles()
  const [detailVehicle, setDetailVehicle] = useState(null)
  const [showNewVehicle, setShowNewVehicle] = useState(false)
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [vehicleError, setVehicleError] = useState('')
  const [deletingVehicle, setDeletingVehicle] = useState(null)
  const [deleteVehicleError, setDeleteVehicleError] = useState('')

  async function loadStaff() {
    setStaff(await listStaff())
  }

  async function loadFactoryEmployees() {
    const employees = await listEmployees()
    setFactoryEmployees(employees.filter((employee) => !employee.profile_id))
  }

  useEffect(() => {
    loadStaff()
    loadFactoryEmployees()
  }, [])

  async function handleToggleActive(profile) {
    await setProfileActive(profile.id, !profile.active)
    loadStaff()
  }

  async function handleToggleEmployeeActive(employee) {
    await setEmployeeActive(employee.id, !employee.active)
    loadFactoryEmployees()
  }

  async function handleToggleVehicleActive(vehicle) {
    await setVehicleActive(vehicle.id, !vehicle.active)
    reloadVehicles()
  }

  async function handleCreateVehicle(event) {
    event.preventDefault()
    setSavingVehicle(true)
    setVehicleError('')
    try {
      await createVehicle(vehicleForm)
      setVehicleForm(EMPTY_VEHICLE_FORM)
      setShowNewVehicle(false)
      reloadVehicles()
    } catch (error) {
      setVehicleError(
        error.code === '23505' ? 'Ya existe un vehículo con esa patente.' : error.message || 'No se pudo guardar el vehículo.'
      )
    } finally {
      setSavingVehicle(false)
    }
  }

  function closeNewVehicle() {
    setShowNewVehicle(false)
    setVehicleForm(EMPTY_VEHICLE_FORM)
    setVehicleError('')
  }

  async function handleDeleteVehicle() {
    setDeleteVehicleError('')
    try {
      await deleteVehicle(deletingVehicle.id)
      setDeletingVehicle(null)
      reloadVehicles()
    } catch (error) {
      setDeleteVehicleError(
        error.message?.includes('foreign key') ? 'No se puede eliminar: el vehículo tiene hojas de ruta asociadas.' : error.message || 'No se pudo eliminar el vehículo.'
      )
    }
  }

  function renderFactoryEmployees() {
    if (factoryEmployees === null) return <Spinner label="Cargando empleados…" />
    if (factoryEmployees.length === 0) {
      return (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
          <EmptyState
            icon="badge"
            title="Sin empleados de fábrica"
            description="Cargá acá al personal que solo ficha en el reloj de la fábrica y no usa la app."
          />
        </div>
      )
    }
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <ul className="divide-y divide-outline-variant/50">
          {factoryEmployees.map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                onClick={() => setEmployeeModal({ employee })}
                className="w-full flex items-center justify-between gap-sm p-md text-left hover:bg-surface-container-low transition-colors"
              >
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{employee.full_name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {employee.clock_pin ? `N° en el reloj: ${employee.clock_pin}` : 'Sin N° en el reloj'}
                    {employee.dni && ` · DNI ${employee.dni}`}
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <StatusChip label={employee.active ? 'Activo' : 'Inactivo'} tone={employee.active ? 'success' : 'error'} variant="dot" />
                  <Button
                    variant={employee.active ? 'destructive-outline' : 'secondary-outline'}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleToggleEmployeeActive(employee)
                    }}
                  >
                    {employee.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (!staff) return <Spinner label="Cargando personal…" />

  return (
    <div>
      <div className="flex items-center justify-between gap-sm mb-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Personal</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Gestioná las cuentas del equipo, los empleados de fábrica y la flota de vehículos.
          </p>
        </div>
        {activeTab === TAB.PERSONAL && (
          <Button variant="primary" icon="person_add" onClick={() => navigate('/supervisor/personal/nuevo')}>
            Nuevo Personal
          </Button>
        )}
        {activeTab === TAB.FABRICA && (
          <Button variant="primary" icon="person_add" onClick={() => setEmployeeModal({ employee: null })}>
            Nuevo Empleado
          </Button>
        )}
        {activeTab === TAB.VEHICULOS && (
          <Button variant="primary" icon="add" onClick={() => setShowNewVehicle(true)}>
            Nuevo Vehículo
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-sm mb-lg">
        <Button variant={activeTab === TAB.PERSONAL ? 'primary' : 'secondary-outline'} onClick={() => setActiveTab(TAB.PERSONAL)}>
          Personal
        </Button>
        <Button variant={activeTab === TAB.FABRICA ? 'primary' : 'secondary-outline'} onClick={() => setActiveTab(TAB.FABRICA)}>
          Empleados de fábrica
        </Button>
        <Button variant={activeTab === TAB.VEHICULOS ? 'primary' : 'secondary-outline'} onClick={() => setActiveTab(TAB.VEHICULOS)}>
          Vehículos
        </Button>
      </div>

      {activeTab === TAB.PERSONAL && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <ul className="divide-y divide-outline-variant/50">
            {staff.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setDetailStaff(person)}
                  className="w-full flex items-center justify-between gap-sm p-md text-left hover:bg-surface-container-low transition-colors"
                >
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">{person.full_name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">@{person.username}</p>
                  </div>
                  <div className="flex items-center gap-md">
                    <StatusChip label={ROLE_LABELS[person.role]} tone={ROLE_TONE[person.role]} variant="tag" />
                    <Button
                      variant={person.active ? 'destructive-outline' : 'secondary-outline'}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleToggleActive(person)
                      }}
                    >
                      {person.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === TAB.FABRICA && renderFactoryEmployees()}

      {activeTab === TAB.VEHICULOS &&
        (vehiclesLoading ? (
          <Spinner label="Cargando vehículos…" />
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
            <ul className="divide-y divide-outline-variant/50">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    onClick={() => setDetailVehicle(vehicle)}
                    className="w-full flex items-center justify-between gap-sm p-md text-left hover:bg-surface-container-low transition-colors"
                  >
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">{vehicle.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{vehicle.plate}</p>
                    </div>
                    <div className="flex items-center gap-md">
                      <Button
                        variant={vehicle.active ? 'destructive-outline' : 'secondary-outline'}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleToggleVehicleActive(vehicle)
                        }}
                      >
                        {vehicle.active ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="destructive-outline"
                        icon="delete"
                        className="rounded-full"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteVehicleError('')
                          setDeletingVehicle(vehicle)
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

      <StaffDetailPanel
        staff={detailStaff}
        onClose={() => setDetailStaff(null)}
        onUpdated={(updated) => {
          setDetailStaff(updated)
          loadStaff()
        }}
      />

      <VehicleDetailPanel
        vehicle={detailVehicle}
        onClose={() => setDetailVehicle(null)}
        onUpdated={(updated) => {
          setDetailVehicle(updated)
          reloadVehicles()
        }}
      />

      {employeeModal && (
        <FactoryEmployeeModal
          employee={employeeModal.employee}
          onClose={() => setEmployeeModal(null)}
          onSaved={async () => {
            setEmployeeModal(null)
            await loadFactoryEmployees()
          }}
        />
      )}

      <Modal
        open={showNewVehicle}
        title="Nuevo Vehículo"
        onClose={savingVehicle ? () => {} : closeNewVehicle}
        size="md"
        actions={[
          { label: 'Cancelar', variant: 'secondary-outline', onClick: closeNewVehicle, disabled: savingVehicle },
          { label: savingVehicle ? 'Guardando…' : 'Guardar Vehículo', variant: 'primary', type: 'submit', form: 'new-vehicle-form', disabled: savingVehicle },
        ]}
      >
        <form id="new-vehicle-form" onSubmit={handleCreateVehicle} className="space-y-md">
          <FormSection title="Datos del Vehículo">
            <div className="space-y-md">
              <Field label="Patente" value={vehicleForm.plate} onChange={(v) => setVehicleForm((f) => ({ ...f, plate: v }))} required />
              <Field label="Nombre" value={vehicleForm.name} onChange={(v) => setVehicleForm((f) => ({ ...f, name: v }))} required />
            </div>
          </FormSection>
          {vehicleError && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {vehicleError}
            </p>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingVehicle)}
        title={`Eliminar ${deletingVehicle?.name ?? ''}`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => {
          setDeletingVehicle(null)
          setDeleteVehicleError('')
        }}
        onConfirm={handleDeleteVehicle}
      >
        ¿Seguro que querés eliminar este vehículo? Esta acción no se puede deshacer.
        {deleteVehicleError && <span role="alert" className="block text-error mt-sm">{deleteVehicleError}</span>}
      </ConfirmModal>
    </div>
  )
}
