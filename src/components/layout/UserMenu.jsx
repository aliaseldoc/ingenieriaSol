import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_HOME_PATH } from '../../lib/constants'

function getInitials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export default function UserMenu({ compact = false }) {
  const { profile, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!profile) return null

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-sm rounded-full hover:bg-surface-variant/50 p-xs transition-colors"
      >
        <span className="w-[4.4rem] h-[4.4rem] shrink-0 rounded-full bg-primary-fixed-dim flex items-center justify-center font-label-md text-label-md text-on-primary-fixed border border-outline-variant">
          {getInitials(profile.full_name)}
        </span>
        {!compact && (
          <>
            <span className="font-label-md text-label-md text-on-surface">{profile.full_name}</span>
            <span className="material-symbols-outlined text-[2rem] text-on-surface-variant">arrow_drop_down</span>
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-sm w-[20rem] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden">
            <Link
              to={`${ROLE_HOME_PATH[profile.role]}/perfil`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-sm px-md py-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[2rem] text-on-surface-variant">person</span>
              Mi Perfil
            </Link>
            <div className="border-t border-outline-variant" />
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-sm px-md py-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[2rem] text-on-surface-variant">logout</span>
              Cerrar Sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}
