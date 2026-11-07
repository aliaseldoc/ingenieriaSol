import { useSyncExternalStore } from 'react'
import { THEME, getActiveTheme, saveTheme, subscribeTheme } from '../../lib/theme'

// Boton del encabezado para pasar de modo claro a nocturno y al reves. Muestra
// el modo al que lleva: la luna en claro, el sol en nocturno.
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getActiveTheme)
  const isDark = theme === THEME.DARK
  const label = isDark ? 'Activar modo claro' : 'Activar modo nocturno'

  return (
    <button
      type="button"
      onClick={() => saveTheme(isDark ? THEME.LIGHT : THEME.DARK)}
      aria-label={label}
      title={label}
      className="w-[4.4rem] h-[4.4rem] shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
    >
      <span className="material-symbols-outlined text-[2.4rem]">{isDark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  )
}
