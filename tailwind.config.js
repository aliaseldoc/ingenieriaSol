/**
 * Sistema "Precisión Industrial" — rediseño sobre los tokens originalmente
 * extraídos de Desing/stitch_ingenieria_sol_service_portal. Se mantienen los
 * mismos NOMBRES de token (para que los ~70 archivos que ya los consumen se
 * repinten solos) y se reemplazan los VALORES. Ver el plan de diseño para el
 * detalle de cada familia de color.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Los valores viven en src/index.css como variables (--c-<nombre>), con un
      // juego para el modo claro y otro para el nocturno (pedido del 24/10/2026).
      // El prefijo no puede ser --color-: Tailwind ya define --color-<nombre>
      // con el valor de aca, y quedaria apuntandose a si mismo.
      colors: Object.fromEntries(
        [
          'background',
          'surface',
          'surface-bright',
          'surface-container-lowest',
          'surface-container-low',
          'surface-container',
          'surface-container-high',
          'surface-container-highest',
          'surface-variant',
          'surface-dim',
          'surface-tint',
          'on-surface',
          'on-background',
          'on-surface-variant',
          'outline',
          'outline-variant',
          'primary',
          'on-primary',
          'primary-container',
          'on-primary-container',
          'primary-fixed',
          'primary-fixed-dim',
          'on-primary-fixed',
          'on-primary-fixed-variant',
          'secondary',
          'on-secondary',
          'secondary-container',
          'on-secondary-container',
          'secondary-fixed',
          'secondary-fixed-dim',
          'on-secondary-fixed',
          'on-secondary-fixed-variant',
          'tertiary',
          'on-tertiary',
          'tertiary-container',
          'on-tertiary-container',
          'tertiary-fixed',
          'tertiary-fixed-dim',
          'on-tertiary-fixed',
          'on-tertiary-fixed-variant',
          'warning',
          'on-warning',
          'warning-container',
          'on-warning-container',
          'error',
          'on-error',
          'error-container',
          'on-error-container',
          'inverse-surface',
          'inverse-on-surface',
          'inverse-primary',
          'bar',
          'bar-light',
          'on-bar',
          'scrim',
        ].map((name) => [name, `var(--c-${name})`])
      ),
      // Ojo: estos nombres (xs/sm/md/lg/xl) tambien son usados internamente
      // por la escala de max-w-*, y en Tailwind v4 spacing tiene prioridad
      // sobre ese valor por defecto. Por eso max-w-sm/md/lg/xl NO deben
      // usarse en este proyecto: usar max-w-[Nrem] (valor arbitrario) en su lugar.
      spacing: {
        base: '0.4rem',
        xs: '0.4rem',
        sm: '0.8rem',
        md: '1.6rem',
        lg: '2.4rem',
        xl: '3.2rem',
        gutter: '1.6rem',
        'margin-mobile': '1.6rem',
        'margin-desktop': '3.2rem',
      },
      // Mas redondeado, como la propuesta de Seguimiento (24/10/2026).
      borderRadius: {
        DEFAULT: '0.8rem',
        lg: '1.2rem',
        xl: '1.6rem',
        full: '9999px',
      },
      boxShadow: {
        // Sombra ajustada y de poco desenfoque — como una sombra proyectada
        // por luz direccional, no el "glow" difuso típico de SaaS. Tintada
        // con `ink` (on-surface) en vez de negro puro.
        'elevation-1': 'var(--c-shadow-1)',
        'elevation-2': 'var(--c-shadow-2)',
      },
      fontFamily: {
        'display-lg': ['"Big Shoulders"', 'sans-serif'],
        'headline-lg': ['"Big Shoulders"', 'sans-serif'],
        'headline-lg-mobile': ['"Big Shoulders"', 'sans-serif'],
        'headline-md': ['"Big Shoulders"', 'sans-serif'],
        'body-lg': ['"Public Sans"', 'sans-serif'],
        'body-md': ['"Public Sans"', 'sans-serif'],
        'body-sm': ['"Public Sans"', 'sans-serif'],
        'label-md': ['"JetBrains Mono"', 'monospace'],
        'label-sm': ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display-lg': ['4.8rem', { lineHeight: '5.2rem', letterSpacing: '-0.01em', fontWeight: '800' }],
        'headline-lg': ['3.2rem', { lineHeight: '3.6rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg-mobile': ['2.4rem', { lineHeight: '2.8rem', fontWeight: '700' }],
        'headline-md': ['2.4rem', { lineHeight: '2.8rem', fontWeight: '700' }],
        'body-lg': ['1.8rem', { lineHeight: '2.8rem', fontWeight: '400' }],
        'body-md': ['1.6rem', { lineHeight: '2.4rem', fontWeight: '400' }],
        'body-sm': ['1.4rem', { lineHeight: '2.0rem', fontWeight: '400' }],
        'label-md': ['1.4rem', { lineHeight: '1.6rem', letterSpacing: '0.02em', fontWeight: '500' }],
        'label-sm': ['1.2rem', { lineHeight: '1.6rem', letterSpacing: '0.05em', fontWeight: '500' }],
      },
    },
  },
}
