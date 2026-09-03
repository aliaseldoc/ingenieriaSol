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

## Mudarse a otra cuenta de EmailJS

Cambiar de cuenta **no toca una línea de código**: la Edge Function no tiene
nada de EmailJS hardcodeado, todo entra por secrets. Lo que hay que rehacer es
la configuración del panel y los cinco secrets.

Antes que nada, una distinción que conviene tener clara: **la dirección con la
que se inicia sesión en EmailJS y la dirección desde la que salen los mails son
cosas distintas.** La primera es administrativa (dueño de la cuenta, avisos de
EmailJS). El remitente lo define el *service* conectado. Cambiar de cuenta no
cambia por sí solo desde qué dirección salen los mails.

Orden recomendado:

1. **Crear la cuenta** con la dirección que corresponda.
2. **Conectar el service** — ver la sección siguiente. Va antes de las
   plantillas porque la verificación del dominio remitente es lo que más
   tarda, y conviene largarla temprano.
3. **Crear las dos plantillas** y pegar el HTML de esta carpeta (por eso están
   versionadas), con su Settings como se indica más arriba.
4. **Actualizar los cinco secrets** en Supabase → Edge Functions → Secrets
   (o `supabase secrets set` si tenés el CLI instalado):

   | Secret | De dónde sale en el panel nuevo |
   |---|---|
   | `EMAILJS_SERVICE_ID` | Email Services → el service conectado |
   | `EMAILJS_PUBLIC_KEY` | Account → General → Public Key |
   | `EMAILJS_PRIVATE_KEY` | Account → General → Private Key |
   | `EMAILJS_TEMPLATE_ID_NOTIFICATION` | Email Templates → plantilla de aviso |
   | `EMAILJS_TEMPLATE_ID_RESULTS` | Email Templates → plantilla de resultados |

   **Los cinco cambian**: en una cuenta nueva, el service y las plantillas son
   nuevos, así que sus ids también.

5. En Account → Security, verificar que esté habilitado el uso de la API desde
   aplicaciones que no son un navegador. La Edge Function llama a la API REST
   desde el servidor; con esa opción apagada, EmailJS rechaza todo.
6. Probar: enviar un aviso de visita y unos resultados, y confirmar que el mail
   llega con el logo visible.

La cuenta vieja se puede dar de baja recién después de que el paso 6 funcione.

## Elegir el service: por qué no una casilla personal

La documentación de EmailJS es explícita: una casilla personal (Gmail, Outlook)
*"puede ser bloqueada si superás el límite diario del proveedor"* y la dirección
*"puede ser marcada como spam si enviás correos no solicitados a varios
destinatarios"*. Las recomiendan **solo para desarrollo o volumen muy bajo**.

Esta app hace exactamente lo que desaconsejan: manda mails automáticos, en
tanda (uno por cliente de la hoja de ruta), a destinatarios que no pidieron ese
correo. Sobre una casilla personal se va a bloquear de nuevo — ya pasó una vez
con el error `Account access has been temporary suspended`.

Lo que corresponde en producción es conectar un **servicio transaccional**
(Brevo, Resend, SendGrid) como service de EmailJS, por SMTP. Eso además obliga
a verificar el dominio remitente con registros SPF y DKIM en el DNS, que es
justamente lo que hace que los mails no caigan en spam.

**Ojo con esto**: autenticar el dominio con SPF y DKIM requiere acceso al DNS de
`ingenieriasol.com.ar`. Es el paso que más demora (la propagación puede tardar
horas) y es el que de verdad mejora la entregabilidad.

### Sin acceso al DNS: verificar un remitente individual

Mientras no haya DNS, el camino que funciona es **single sender verification**:
el proveedor manda un mail de confirmación a la dirección remitente y alcanza
con hacer clic. **Necesita acceso al buzón, no al DNS.** Se puede mandar a
cualquier destinatario igual, con dos contras a tener presentes:

- Sin SPF/DKIM hay más riesgo de caer en spam. Hay que revisar esa carpeta al
  probar, y volver sobre la autenticación del dominio apenas haya DNS.
- El plan gratis de Brevo agrega una línea *"Sent with Brevo"* al pie del mail.
  En un correo con membrete a un cliente se nota; se saca con el plan pago.

Brevo se elige por descarte: el plan gratis de SendGrid dejó de existir en 2026
(60 días de prueba y después pago), y Resend sin dominio verificado solo deja
mandarse mails a uno mismo. Brevo son 300/día gratis para siempre y no exige
dominio para arrancar.

### Configuración concreta (Brevo por SMTP)

1. Cuenta en brevo.com.
2. *Senders, Domains & Dedicated IPs* → **Senders** → *Add a sender* con la
   dirección remitente → confirmar desde ese buzón.
3. *Settings* → **SMTP & API** → solapa **SMTP** → *Generate a new SMTP key*:

   | Dato | Valor |
   |---|---|
   | Servidor | `smtp-relay.brevo.com` |
   | Puerto | `587` |
   | Usuario | el **SMTP login** que muestra el panel |
   | Contraseña | la **SMTP key** — no la API key, son distintas |

4. En EmailJS, *Add New Service* con la opción **SMTP** y esos cuatro datos.
   *From Email* = el remitente verificado, *From Name* = `Ingeniería Sol`.

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
