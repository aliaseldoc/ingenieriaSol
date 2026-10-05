// El modulo de fichaje esta en marcha blanca: el reloj ya recibe fichajes
// pero la norma todavia no rige en la fabrica, asi que en produccion no se
// muestra para no confundir a nadie. Mientras este apagado desaparecen las
// pantallas de fichaje, sus items de menu, las alertas del panel, la solapa de
// empleados de fabrica y el campo "N° en el reloj".
//
// Es una bandera de compilacion: Vite reemplaza la expresion por una
// constante, asi que lo que no se habilita ni siquiera entra al paquete y no
// queda accesible escribiendo la direccion a mano. Se prende poniendo
// VITE_FICHAJE_HABILITADO=true (ya esta en .env para desarrollo); en
// produccion se prende agregando la variable al workflow de GitHub Pages.
//
// Vive aparte de constants.js a proposito: constants.js lo importa tambien la
// Edge Function de cierre semanal (Deno), donde import.meta.env no existe. Y
// la expresion tiene que quedar tal cual, sin "?.", para que Vite la pueda
// reemplazar por la constante.
//
// Importante: NO apaga la toma de fichajes. El endpoint /iclock corre en el
// servidor (api/iclock.js) y no mira esta bandera, asi que el reloj sigue
// registrando todo mientras la pantalla esta oculta.
export const FICHAJE_HABILITADO = import.meta.env.VITE_FICHAJE_HABILITADO === 'true'
