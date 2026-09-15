import RoleLayoutShell from './RoleLayoutShell'

const NAV_ITEMS = [
  { to: '/supervisor', end: true, icon: 'dashboard', label: 'Panel de Control' },
  { to: '/supervisor/validacion', icon: 'fact_check', label: 'Validación' },
  { to: '/supervisor/equipos', icon: 'precision_manufacturing', label: 'Equipos' },
  { to: '/supervisor/clientes', icon: 'domain', label: 'Clientes' },
  { to: '/supervisor/calendario', icon: 'calendar_month', label: 'Calendario' },
  { to: '/supervisor/personal', icon: 'group', label: 'Personal' },
  { to: '/supervisor/fichajes', icon: 'fingerprint', label: 'Fichajes' },
  { to: '/supervisor/resumen', icon: 'insights', label: 'Resumen' },
]

export default function SupervisorLayout() {
  return <RoleLayoutShell navItems={NAV_ITEMS} title="Ingeniería Sol · Supervisor" />
}
