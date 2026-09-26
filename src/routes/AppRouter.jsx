import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_HOME_PATH } from '../lib/constants'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import Spinner from '../components/ui/Spinner'

import LoginPage from '../pages/LoginPage'
import ProfilePage from '../pages/ProfilePage'

import AdminLayout from '../components/layout/AdminLayout'
import DashboardPage from '../pages/admin/DashboardPage'
import EquipmentPage from '../pages/admin/EquipmentPage'
import ClientsPage from '../pages/admin/ClientsPage'
import CalendarPage from '../pages/admin/CalendarPage'
import ReceptionPage from '../pages/admin/ReceptionPage'
import SummaryPage from '../pages/admin/SummaryPage'
import VisitDetailPage from '../pages/admin/VisitDetailPage'
import RepairsPage from '../pages/admin/RepairsPage'

import TecnicoLayout from '../components/layout/TecnicoLayout'
import MonthlyPlanPage from '../pages/tecnico/MonthlyPlanPage'
import HistoryPage from '../pages/tecnico/HistoryPage'
import VisitFormPage from '../pages/tecnico/VisitFormPage'

import SupervisorLayout from '../components/layout/SupervisorLayout'
import ValidationPage from '../pages/supervisor/ValidationPage'
import StaffListPage from '../pages/supervisor/StaffListPage'
import StaffNewPage from '../pages/supervisor/StaffNewPage'

function RoleHomeRedirect() {
  const { profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner label="Redirigiendo…" />
      </div>
    )
  }
  return <Navigate to={profile ? ROLE_HOME_PATH[profile.role] : '/login'} replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RoleHomeRedirect />} />

        <Route element={<RoleRoute allow={['administrativo']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="equipos" element={<EquipmentPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="recepcion" element={<ReceptionPage />} />
            <Route path="reparaciones" element={<RepairsPage />} />
            <Route path="resumen" element={<SummaryPage />} />
            <Route path="visita/:visitId" element={<VisitDetailPage />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute allow={['tecnico']} />}>
          <Route path="/tecnico" element={<TecnicoLayout />}>
            <Route index element={<MonthlyPlanPage />} />
            <Route path="historial" element={<HistoryPage />} />
            <Route path="visita/:visitId" element={<VisitFormPage />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute allow={['supervisor']} />}>
          <Route path="/supervisor" element={<SupervisorLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="validacion" element={<ValidationPage />} />
            <Route path="reparaciones" element={<RepairsPage />} />
            <Route path="equipos" element={<EquipmentPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="personal" element={<StaffListPage />} />
            <Route path="personal/nuevo" element={<StaffNewPage />} />
            <Route path="visita/:visitId" element={<VisitDetailPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="resumen" element={<SummaryPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
