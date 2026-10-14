import { useConnectivityStatus } from './useOfflineSync'
import EmptyState from '../components/ui/EmptyState'

// Pantallas que se consultan solo con conexion (el calendario del tecnico y
// el detalle de visitas de otros): sin senal muestran este aviso en vez de
// quedar cargando o vacias. Cuando vuelve la conexion la pantalla se monta de
// nuevo y carga sola.
export default function OnlineOnly({ title, children }) {
  const online = useConnectivityStatus()
  if (online) return children

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-lg">{title}</h1>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg">
        <EmptyState
          icon="cloud_off"
          title="Sin conexión"
          description="Esta pantalla necesita conexión. Mi Plan y tus formularios de visita siguen funcionando sin conexión."
        />
      </div>
    </div>
  )
}
