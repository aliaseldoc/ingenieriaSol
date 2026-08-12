const TONE_CLASSES = {
  primary: 'bg-secondary-container text-on-secondary-container',
  secondary: 'bg-tertiary-fixed-dim text-on-tertiary-fixed-variant',
  warning: 'bg-warning-container text-on-warning-container',
  soft: 'bg-secondary-fixed-dim text-on-secondary-fixed-variant',
}

export default function KpiCard({ icon, label, value, sublabel, statusChip = null, onClick = null, tone = 'primary' }) {
  const Container = onClick ? 'button' : 'div'

  return (
    <Container
      type={onClick ? 'button' : undefined}
      onClick={onClick ?? undefined}
      className={`relative mx-auto w-[17rem] h-[17rem] md:w-[20rem] md:h-[20rem] shrink-0 rounded-full flex flex-col items-center justify-center text-center gap-xs p-lg shadow-elevation-1 ${TONE_CLASSES[tone]} ${onClick ? 'hover:shadow-elevation-2 hover:scale-[1.03] transition-all cursor-pointer' : ''}`}
    >
      {statusChip && <span className="absolute top-md right-md">{statusChip}</span>}
      <span className="material-symbols-outlined text-[3.2rem]">{icon}</span>
      <p className="font-display-lg text-display-lg leading-none">{value}</p>
      <p className="font-label-sm text-label-sm uppercase tracking-wide leading-tight px-md break-words">{label}</p>
      {sublabel && <p className="font-body-sm text-body-sm opacity-80 leading-tight px-xs break-words">{sublabel}</p>}
    </Container>
  )
}
