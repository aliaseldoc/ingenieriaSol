import UserMenu from './UserMenu'

// headerAction: control extra del rol junto al menu de usuario (hoy, la
// campanita de notas del tecnico).
export default function TopBar({ title, headerAction = null }) {
  return (
    <header className="hidden md:flex fixed top-0 right-0 left-[25.6rem] h-[6.4rem] bg-surface border-b border-outline-variant justify-between items-center px-margin-desktop z-30">
      <span className="font-headline-md text-headline-md font-extrabold text-on-surface">{title}</span>
      <div className="flex items-center gap-sm">
        {headerAction}
        <UserMenu />
      </div>
    </header>
  )
}
