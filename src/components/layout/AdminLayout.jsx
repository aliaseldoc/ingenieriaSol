import RoleLayoutShell from './RoleLayoutShell'
import SyncStatusBar from './SyncStatusBar'
import { FICHAJE_HABILITADO } from '../../lib/featureFlags'

const NAV_ITEMS = [
  { to: '/admin', end: true, icon: 'dashboard', label: 'Panel de Control' },
  { to: '/admin/equipos', icon: 'precision_manufacturing', label: 'Equipos' },
  { to: '/admin/clientes', icon: 'domain', label: 'Clientes' },
  { to: '/admin/datos-incompletos', icon: 'assignment_late', label: 'Datos Incompletos' },
  { to: '/admin/calendario', icon: 'calendar_month', label: 'Calendario' },
  { to: '/admin/recepcion', icon: 'fact_check', label: 'Recepción' },
  { to: '/admin/reparaciones', icon: 'build', label: 'Reparaciones' },
  { to: '/admin/resumen', icon: 'insights', label: 'Resumen' },
  ...(FICHAJE_HABILITADO ? [{ to: '/admin/fichaje', icon: 'fingerprint', label: 'Fichaje' }] : []),
]

// El administrativo ficha igual que el tecnico, y puede hacerlo sin conexion:
// la barra de sincronizacion es la que sube esos fichajes cuando vuelve la
// red. Sin fichaje no hace falta.
export default function AdminLayout() {
  return (
    <RoleLayoutShell
      navItems={NAV_ITEMS}
      title="Ingeniería Sol · Administración"
      statusBar={FICHAJE_HABILITADO ? <SyncStatusBar /> : null}
    />
  )
}
