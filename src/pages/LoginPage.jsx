import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginCard from '../components/ui/LoginCard'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { signInWithUsername } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { isNetworkError } from '../offline/network'

export default function LoginPage() {
  const navigate = useNavigate()
  const { accessDenied, clearAccessDenied } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secureSession, setSecureSession] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    clearAccessDenied()
    setSubmitting(true)
    try {
      await signInWithUsername(username, password)
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(
        isNetworkError(error)
          ? 'Sin conexión a internet. Necesitás conexión para iniciar sesión por primera vez en este dispositivo.'
          : 'Usuario o contraseña incorrectos.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid-pattern min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-desktop bg-surface-bright">
      <LoginCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label htmlFor="username" className="font-label-md text-label-md text-on-surface-variant flex items-center gap-xs">
              <span className="material-symbols-outlined text-[1.6rem]">person</span>
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="operator_id"
              className="w-full border border-outline rounded bg-surface-container-lowest px-md py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-xs">
            <div className="flex flex-wrap justify-between items-center gap-x-sm gap-y-xs">
              <label htmlFor="password" className="font-label-md text-label-md text-on-surface-variant flex items-center gap-xs">
                <span className="material-symbols-outlined text-[1.6rem]">lock</span>
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="font-label-sm text-label-sm text-secondary hover:text-secondary-container transition-colors whitespace-nowrap"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full border border-outline rounded bg-surface-container-lowest px-md py-sm font-body-md text-body-md text-on-surface focus:border-secondary focus:border-2 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-sm mt-xs">
            <input
              id="remember"
              type="checkbox"
              checked={secureSession}
              onChange={(event) => setSecureSession(event.target.checked)}
              className="w-[1.6rem] h-[1.6rem] rounded border-outline accent-secondary"
            />
            <label htmlFor="remember" className="font-body-sm text-body-sm text-on-surface-variant">
              Sesión Segura
            </label>
          </div>

          {(errorMessage || accessDenied) && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {errorMessage || accessDenied}
            </p>
          )}

          <Button type="submit" disabled={submitting} fullWidth icon="login" className="mt-md">
            {submitting ? 'Ingresando…' : 'Iniciar Sesión'}
          </Button>
        </form>
      </LoginCard>

      <Modal
        open={showForgotPassword}
        title="Recuperar acceso"
        onClose={() => setShowForgotPassword(false)}
        fullViewport
        actions={[{ label: 'Entendido', onClick: () => setShowForgotPassword(false) }]}
      >
        <p className="font-body-md text-body-md text-on-surface">
          Para restablecer tu contraseña, contactá a un supervisor: solo ellos pueden gestionar el acceso del
          personal.
        </p>
      </Modal>
    </div>
  )
}
