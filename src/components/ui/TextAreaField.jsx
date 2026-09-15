export default function TextAreaField({ label, value, onChange, required = false, rows = 3, placeholder = '', className = '' }) {
  return (
    <div className={`space-y-xs ${className}`}>
      <label className="font-label-sm text-label-sm text-on-surface block">{label}</label>
      <textarea
        required={required}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-surface-container-lowest border border-outline rounded-lg px-md py-sm font-body-md text-body-md text-on-surface hover:border-on-surface-variant focus:border-secondary focus:border-2 focus:outline-none transition-all resize-y"
      />
    </div>
  )
}
