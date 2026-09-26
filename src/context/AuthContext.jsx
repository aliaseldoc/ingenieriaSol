import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getProfile } from '../api/profiles'
import { signOut as signOutRequest } from '../api/auth'
import { isNetworkError } from '../offline/network'
import { cacheProfile, getCachedProfile } from '../offline/routeSheetCache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    // Usuario del perfil que quedo cargado (null si no hay perfil). Distingue
    // un cambio real de usuario de los avisos que Supabase repite con la misma
    // sesion (ver onAuthStateChange mas abajo). Sigue al perfil y no a la
    // sesion para que, si el perfil no se pudo cargar, el proximo aviso lo
    // vuelva a intentar.
    let profileUserId = null

    function applyProfile(nextProfile) {
      profileUserId = nextProfile?.id ?? null
      if (isMounted) setProfile(nextProfile)
    }

    async function loadProfileForSession(currentSession) {
      if (!currentSession) {
        applyProfile(null)
        return
      }
      try {
        const loadedProfile = await getProfile(currentSession.user.id)
        applyProfile(loadedProfile)
        // La copia local es solo para poder entrar sin conexion. Si no se
        // puede guardar, el perfil ya llego del servidor: no es motivo para
        // dejar al usuario afuera.
        await cacheProfile(loadedProfile).catch((cacheError) => {
          console.error('No se pudo guardar el perfil para uso sin conexión', cacheError)
        })
      } catch (error) {
        // Sin red, la sesion (JWT valido en localStorage) puede seguir
        // viva aunque este fetch falle. En vez de cerrar sesion, se usa el
        // ultimo perfil cacheado — solo si es del mismo usuario, para no
        // mostrar datos de otro tecnico en una tablet compartida.
        if (!isNetworkError(error)) {
          applyProfile(null)
          return
        }
        const cachedProfile = await getCachedProfile()
        applyProfile(cachedProfile?.id === currentSession.user.id ? cachedProfile : null)
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      await loadProfileForSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      // Supabase repite SIGNED_IN cada vez que la app vuelve a primer plano
      // (desbloquear el celular, volver de otra app o pestaña) y avisa
      // TOKEN_REFRESHED al renovar el token. Si el usuario es el mismo no hay
      // nada que recargar: marcar loading hacia que ProtectedRoute desmontara
      // la vista actual (con lo que se estuviera cargando) y la armara de cero.
      if ((newSession?.user?.id ?? null) === profileUserId) return
      setLoading(true)
      loadProfileForSession(newSession).finally(() => {
        if (isMounted) setLoading(false)
      })
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await signOutRequest()
    setSession(null)
    setProfile(null)
  }

  const value = { session, profile, loading, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider')
  return context
}
