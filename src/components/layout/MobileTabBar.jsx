import { NavLink } from 'react-router-dom'

export default function MobileTabBar({ navItems }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[6.4rem] bg-surface-container-lowest border-t border-outline-variant flex items-stretch z-40">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          aria-label={item.label}
          title={item.label}
          className={({ isActive }) =>
            `flex-1 flex items-center justify-center transition-colors ${
              isActive ? 'text-secondary' : 'text-on-surface-variant'
            }`
          }
        >
          <span className="material-symbols-outlined text-[2.2rem]">{item.icon}</span>
        </NavLink>
      ))}
    </nav>
  )
}
