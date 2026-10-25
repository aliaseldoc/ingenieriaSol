const TONE_CLASSES = {
  success: 'bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-variant text-on-surface-variant',
}

// size solo cambia la variante 'tag': 'lg' es para un numero que se tiene que
// leer de un vistazo (el porcentaje de combustible en Seguimiento).
const TAG_SIZE_CLASSES = {
  md: 'rounded-[0.125rem] px-sm py-[0.2rem] font-label-sm text-label-sm',
  lg: 'shrink-0 rounded min-w-[6.4rem] text-center px-sm py-xs font-headline-md text-headline-md tabular-nums',
}

export default function StatusChip({ label, tone = 'neutral', variant = 'pill', size = 'md' }) {
  const toneClass = TONE_CLASSES[tone]

  if (variant === 'dot') {
    return (
      <span className="inline-flex items-center gap-xs font-label-sm text-label-sm">
        <span className={`w-sm h-sm rounded-full ${toneClass}`} aria-hidden="true" />
        {label}
      </span>
    )
  }

  if (variant === 'tag') {
    return (
      <span className={`inline-block uppercase ${TAG_SIZE_CLASSES[size]} ${toneClass}`}>
        {label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center rounded-full px-sm py-[0.2rem] font-label-sm text-label-sm ${toneClass}`}>
      {label}
    </span>
  )
}
