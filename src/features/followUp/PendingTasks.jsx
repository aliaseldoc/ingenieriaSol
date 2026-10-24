import { useNavigate } from 'react-router-dom'

// Lo que espera a cada rol, con acceso a la pantalla donde se resuelve. Cada
// item: { key, label, value (null mientras carga), to }.
export default function PendingTasks({ items }) {
  const navigate = useNavigate()

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <h2 className="list-title-bar font-label-md text-label-md uppercase tracking-wide px-md py-sm">Pendientes</h2>
      <ul className="p-md flex flex-col gap-sm">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => navigate(item.to)}
              className="w-full flex items-center justify-between gap-sm rounded-lg bg-surface px-md py-sm text-left hover:bg-surface-container-low transition-colors"
            >
              <span className="font-body-md text-body-md text-on-surface">{item.label}</span>
              <span className={`font-headline-md text-headline-md ${item.value > 0 ? 'text-warning' : 'text-on-surface'}`}>
                {item.value ?? '…'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
