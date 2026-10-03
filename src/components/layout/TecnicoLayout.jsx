import RoleLayoutShell from './RoleLayoutShell'
import SyncStatusBar from './SyncStatusBar'
import { SupervisorNotesProvider } from '../../features/supervisorNotes/SupervisorNotesContext'
import NotificationBell from '../../features/supervisorNotes/NotificationBell'

const NAV_ITEMS = [
  { to: '/tecnico', end: true, icon: 'calendar_month', label: 'Mi Plan' },
  { to: '/tecnico/historial', icon: 'history', label: 'Mi Historial' },
  { to: '/tecnico/fichaje', icon: 'fingerprint', label: 'Fichaje' },
]

export default function TecnicoLayout() {
  return (
    <SupervisorNotesProvider>
      <RoleLayoutShell
        navItems={NAV_ITEMS}
        title="Ingeniería Sol · Técnico"
        statusBar={<SyncStatusBar />}
        headerAction={<NotificationBell />}
      />
    </SupervisorNotesProvider>
  )
}
