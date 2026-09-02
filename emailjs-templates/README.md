# Plantillas de EmailJS

Las plantillas de EmailJS viven en el panel web de EmailJS, no en el código: la
Edge Function `send-visit-email` solo manda el `template_id` y los datos. Estos
archivos son la **fuente de verdad versionada** de ese HTML — si alguien edita
la plantilla en el panel, hay que reflejar el cambio acá.

| Archivo | Plantilla | La alimenta |
|---|---|---|
| `notificacion-visita.html` | Aviso de visita programada (`EMAILJS_TEMPLATE_ID_NOTIFICATION`) | `sendNotificationEmails()` |
| `resultados-visita.html` | Resultados de la visita (`EMAILJS_TEMPLATE_ID_RESULTS`) | `sendResultsEmail()` |

## Cómo aplicarlas

1. Entrar a [dashboard.emailjs.com](https://dashboard.emailjs.com) → **Email Templates**.
2. Abrir la plantilla que corresponda (los ids están en los secrets de la Edge
   Function: `npx supabase secrets list`).
3. Botón **`<>`** (Code editor) arriba del editor visual.
4. Reemplazar **todo** el contenido por el del archivo `.html` y **Save**.
5. En la solapa **Settings** de la plantilla, verificar:
   - **To Email**: `{{to_email}}`
   - **From Name**: `Ingeniería Sol`
   - **Reply To**: `carlos.guinazu@ingenieriasol.com.ar`
   - **Subject**:
     - notificación → `Visita técnica programada — {{scheduled_date}}`
     - resultados → `Resultados de la visita técnica — {{equipment_label}}`

## Regla de las variables

- Parámetro terminado en **`_html`** → llega ya armado desde la Edge Function
  → se inserta con **triple llave** `{{{...}}}` para que no se escape.
- Cualquier otro → es texto plano → se inserta con **doble llave** `{{...}}`,
  que EmailJS escapa solo.

Romper esta regla no da error, falla en silencio: con doble llave el HTML se ve
como texto crudo (`<ul><li>…`), y con triple llave sobre un valor ya escapado
aparece `MERCEDES &amp; BENZ`.

## El logo

El encabezado apunta a `https://aliaseldoc.github.io/ingenieriaSol/logo-email.png`,
que se publica desde `public/logo-email.png` con el deploy de GitHub Pages. Es
una URL absoluta a propósito: los clientes de correo no resuelven rutas
relativas ni renderizan SVG ni máscaras CSS.

**Esa URL solo existe después de mergear a `main` y que corra el deploy.** Si se
pegan las plantillas antes, el logo sale roto.

Si alguna vez cambia el logo de la app, regenerar el PNG desde
`src/assets/logo-ingenieria-sol.svg`, que es una silueta pensada para usarse
como máscara: hay que pintarla del verde de marca (`#1f4a3d`) y exportarla a
PNG a 3x del ancho de uso (840×412 para mostrarse a 280px).

## Por qué el HTML es así

Va con **tablas, píxeles y estilos en línea**, en contra de las preferencias de
código del proyecto. No es un descuido: los clientes de correo — Outlook sobre
todo — no soportan flexbox, grid, hojas de estilo externas ni unidades `rem`.
Es el único formato que se ve igual en Gmail, Outlook y Apple Mail.

El bloque de datos va con la etiqueta arriba y el valor abajo en vez de dos
columnas, porque con una columna de ancho fijo un nombre de equipo largo se
parte en cuatro líneas en el celular.

## Lo que quedó afuera a propósito

El `.doc` original (`Desing/Hoja carlos guiñazu (1).doc`) trae la **firma
manuscrita escaneada** de Carlos Guiñazú en el pie. No se incluye: son mails
automáticos que dispara el sistema, y una firma manuscrita en un mensaje que
nadie firmó de puño y letra da a entender algo que no pasó. El pie lleva los
datos de la empresa, que es lo que corresponde.

También quedó afuera el sol "IS" en negro del membrete: por decisión del
usuario el encabezado lleva solo el logo de la app, sin retocar los verdes.
