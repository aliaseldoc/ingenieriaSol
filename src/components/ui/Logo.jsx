import logoUrl from '../../assets/logo-ingenieria-sol.svg'

// El logo de la empresa es de un solo color, asi que en vez de mantener una
// copia por fondo se pinta como mascara: la silueta recorta el color de
// texto del contexto (blanco sobre la barra lateral y el login, que son
// oscuros; verde de marca sobre el encabezado claro del mobile).
const MASK_STYLE = {
  maskImage: `url(${logoUrl})`,
  WebkitMaskImage: `url(${logoUrl})`,
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
}

// La relacion de aspecto es la del viewBox del SVG (622 x 305); se fija aca
// para que baste con darle el ancho al componente.
export default function Logo({ className = '' }) {
  return (
    <span
      role="img"
      aria-label="Ingeniería Sol"
      style={MASK_STYLE}
      className={`block aspect-[622/305] bg-current ${className}`}
    />
  )
}
