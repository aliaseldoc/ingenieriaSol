export default function ActivityList({ items, onSelect = null }) {
  if (items.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant p-md">Sin actividad reciente.</p>
  }

  const ItemContainer = onSelect ? 'button' : 'div'

  return (
    <ul className="divide-y divide-outline-variant/50">
      {items.map((item) => (
        <li key={item.id}>
          <ItemContainer
            type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(item) : undefined}
            className={`w-full flex items-start gap-sm p-md text-left hover:bg-surface-container-low transition-colors ${onSelect ? 'cursor-pointer' : ''}`}
          >
            <span className={`material-symbols-outlined text-[2rem] ${item.iconTone ?? 'text-on-surface-variant'}`}>
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-label-md text-on-surface truncate">{item.title}</p>
              {item.subtitle && (
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{item.subtitle}</p>
              )}
              {item.timestamp && (
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">{item.timestamp}</p>
              )}
            </div>
          </ItemContainer>
        </li>
      ))}
    </ul>
  )
}
