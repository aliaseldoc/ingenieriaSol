// inputProps: atributos extra del input nativo (ej. step o min de un monto).
export default function Field({ label, value, onChange, type = 'text', required = false, className = '', inputClassName = '', ...inputProps }) {
  return (
    <div className={`space-y-xs ${className}`}>
      <label className="font-label-sm text-label-sm text-on-surface block">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full bg-surface-container-lowest border border-outline rounded-lg px-md py-sm font-body-md text-body-md text-on-surface hover:border-on-surface-variant focus:border-secondary focus:border-2 focus:outline-none transition-all ${inputClassName}`}
        {...inputProps}
      />
    </div>
  )
}
