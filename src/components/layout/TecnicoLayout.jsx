import RoleLayoutShell from './RoleLayoutShell'
import SyncStatusBar from './SyncStatusBar'

const NAV_ITEMS = [
  { to: '/tecnico', end: true, icon: 'calendar_month', label: 'Mi Plan' },
  { to: '/tecnico/historial', icon: 'history', label: 'Mi Historial' },
  { to: '/tecnico/fichaje', icon: 'fingerprint', label: 'Fichaje' },
]

export default function TecnicoLayout() {
  return <RoleLayoutShell navItems={NAV_ITEMS} title="Ingeniería Sol · Técnico" statusBar={<SyncStatusBar />} />
}
