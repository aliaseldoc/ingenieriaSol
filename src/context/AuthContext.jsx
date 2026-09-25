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

    async function loadProfileForSession(currentSession) {
      if (!currentSession) {
        if (isMounted) setProfile(null)
        return
      }
      try {
        const loadedProfile = await getProfile(currentSession.user.id)
        if (isMounted) setProfile(loadedProfile)
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
          if (isMounted) setProfile(null)
          return
        }
        const cachedProfile = await getCachedProfile()
        if (isMounted) setProfile(cachedProfile?.id === currentSession.user.id ? cachedProfile : null)
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
