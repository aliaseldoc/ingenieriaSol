// Interruptor on/off. El control real es un checkbox nativo (role="switch"):
// queda oculto a la vista pero conserva foco, teclado y lectores de pantalla.
// La pista y la perilla se dibujan con CSS segun su estado :checked.
export default function Switch({ id, checked, onChange, label, disabled = false }) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative shrink-0 w-[4.4rem] h-[2.4rem] rounded-full bg-outline transition-colors peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface after:absolute after:top-[0.3rem] after:left-[0.3rem] after:w-[1.8rem] after:h-[1.8rem] after:rounded-full after:bg-surface-container-lowest after:transition-transform peer-checked:after:translate-x-[2rem]"
      />
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
    </label>
  )
}
