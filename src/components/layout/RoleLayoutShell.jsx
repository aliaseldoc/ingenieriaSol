import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import UserMenu from './UserMenu'
import MobileTabBar from './MobileTabBar'
import Logo from '../ui/Logo'

export default function RoleLayoutShell({ navItems, title, statusBar = null, headerAction = null }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar navItems={navItems} />
      <TopBar title={title} headerAction={headerAction} />

      {/* Tres columnas con los costados fijos al ancho del menu de usuario
          (4.4rem del avatar + su padding): asi el bloque de marca queda
          centrado en el encabezado en cualquier ancho de pantalla, sin que
          el menu lo corra hacia la izquierda. La columna izquierda queda para
          el headerAction del rol (la campanita del tecnico). */}
      <header className="md:hidden grid grid-cols-[5.2rem_1fr_5.2rem] items-center p-margin-mobile border-b border-outline-variant bg-surface">
        <div>{headerAction}</div>
        <div className="text-center">
          <h1>
            <Logo className="w-[14rem] mx-auto text-secondary" />
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mt-xs">
            {title}
          </p>
        </div>
        <div className="justify-self-end">
          <UserMenu compact />
        </div>
      </header>

      <main className="md:pl-[25.6rem] md:pt-[6.4rem] pb-[6.4rem] md:pb-0">
        <div className="p-margin-mobile md:p-margin-desktop">
          {statusBar}
          <Outlet />
        </div>
      </main>

      <MobileTabBar navItems={navItems} />
    </div>
  )
}
