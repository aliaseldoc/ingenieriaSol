import { useState } from 'react'
import StatusChip from '../../components/ui/StatusChip'

// Estructura comun de los dos paneles de alerta del dashboard (combustible y
// service anual): fila con motor + cliente + chip, y — solo para el
// supervisor — un boton al costado para silenciar o reactivar la alerta.
//
// El boton de silenciar es hermano del principal, no va adentro: un <button>
// dentro de otro <button> es HTML invalido.
function AlertRow({ item, onSelect, muteAction }) {
  return (
    <li className="flex items-center">
      <button
        type="button"
        onClick={() => onSelect(item.equipment)}
        className="flex-1 min-w-0 flex items-center justify-between gap-sm p-md text-left hover:bg-surface-container-low transition-colors"
      >
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-on-surface truncate">{item.title}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{item.subtitle}</p>
        </div>
        <StatusChip label={item.chipLabel} tone={item.chipTone} variant="tag" />
      </button>
      {muteAction && (
        <button
          type="button"
          onClick={muteAction.onClick}
          aria-label={muteAction.label}
          title={muteAction.label}
          className="shrink-0 px-md py-md text-on-surface-variant hover:text-secondary transition-colors"
        >
          <span className="material-symbols-outlined text-[2rem] block">{muteAction.icon}</span>
        </button>
      )}
    </li>
  )
}

export default function AlertList({ items, mutedItems, emptyState, onSelect, canMute, onMute, onUnmute }) {
  const [showMuted, setShowMuted] = useState(false)

  if (items.length === 0 && mutedItems.length === 0) return emptyState

  return (
    <>
      {items.length > 0 ? (
        <ul className="divide-y divide-outline-variant/50">
          {items.map((item) => (
            <AlertRow
              key={item.id}
              item={item}
              onSelect={onSelect}
              muteAction={
                canMute ? { icon: 'notifications_off', label: 'Ignorar alerta', onClick: () => onMute(item.equipment) } : null
              }
            />
          ))}
        </ul>
      ) : (
        // Todas silenciadas: el empty state completo ("todos los equipos estan
        // al dia") seria mentira, porque la condicion sigue estando.
        <p className="p-md font-body-sm text-body-sm text-on-surface-variant">Sin alertas activas.</p>
      )}

      {mutedItems.length > 0 && (
        <div className="border-t border-outline-variant">
          <button
            type="button"
            onClick={() => setShowMuted((open) => !open)}
            aria-expanded={showMuted}
            className="w-full flex items-center gap-xs px-md py-sm text-left hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[2rem] text-on-surface-variant">
              {showMuted ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
              Ignoradas ({mutedItems.length})
            </span>
          </button>
          {showMuted && (
            <ul className="divide-y divide-outline-variant/50 opacity-60">
              {mutedItems.map((item) => (
                <AlertRow
                  key={item.id}
                  item={item}
                  onSelect={onSelect}
                  muteAction={
                    canMute
                      ? { icon: 'notifications_active', label: 'Reactivar alerta', onClick: () => onUnmute(item.equipment) }
                      : null
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
