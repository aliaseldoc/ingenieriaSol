import RoleLayoutShell from './RoleLayoutShell'

const NAV_ITEMS = [
  { to: '/admin', end: true, icon: 'dashboard', label: 'Panel de Control' },
  { to: '/admin/equipos', icon: 'precision_manufacturing', label: 'Equipos' },
  { to: '/admin/clientes', icon: 'domain', label: 'Clientes' },
  { to: '/admin/calendario', icon: 'calendar_month', label: 'Calendario' },
  { to: '/admin/recepcion', icon: 'fact_check', label: 'Recepción' },
  { to: '/admin/reparaciones', icon: 'build', label: 'Reparaciones' },
  { to: '/admin/resumen', icon: 'insights', label: 'Resumen' },
]

export default function AdminLayout() {
  return <RoleLayoutShell navItems={NAV_ITEMS} title="Ingeniería Sol · Administración" />
}
