// Modo claro o nocturno (pedido del 24/10/2026). Lo que elige cada usuario se
// guarda en este dispositivo; sin eleccion se sigue al dispositivo, tambien si
// cambia con la app abierta. index.html aplica lo mismo antes de que cargue la
// app (mismas claves), asi no hay un destello claro al abrirla de noche.
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
}

const STORAGE_KEY = 'isol-theme'
const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null
const listeners = new Set()

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === THEME.LIGHT || stored === THEME.DARK ? stored : null
  } catch {
    return null
  }
}

function getDeviceTheme() {
  return darkQuery?.matches ? THEME.DARK : THEME.LIGHT
}

export function getActiveTheme() {
  return getStoredTheme() ?? getDeviceTheme()
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  for (const listener of listeners) listener()
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Sin almacenamiento (modo privado): vale hasta cerrar la app.
  }
  applyTheme(theme)
}

// Para useSyncExternalStore: el boton se entera de cualquier cambio.
export function subscribeTheme(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Se llama una vez al arrancar la app.
export function initTheme() {
  applyTheme(getActiveTheme())
  darkQuery?.addEventListener('change', () => {
    if (!getStoredTheme()) applyTheme(getDeviceTheme())
  })
}
