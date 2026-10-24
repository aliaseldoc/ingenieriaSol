import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppRouter from './routes/AppRouter'
import PwaAutoUpdate from './offline/PwaAutoUpdate'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppRouter />
        <PwaAutoUpdate />
      </AuthProvider>
    </BrowserRouter>
  )
}
