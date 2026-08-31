import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import UserMenu from './UserMenu'
import MobileTabBar from './MobileTabBar'
import Logo from '../ui/Logo'

export default function RoleLayoutShell({ navItems, title, statusBar = null }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar navItems={navItems} />
      <TopBar title={title} />

      <header className="md:hidden flex items-center justify-between p-margin-mobile border-b border-outline-variant bg-surface">
        <div>
          <h1>
            <Logo className="w-[14rem] text-secondary" />
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mt-xs">
            {title}
          </p>
        </div>
        <UserMenu compact />
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
