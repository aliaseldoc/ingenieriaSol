# Mails de la app (`send-visit-email`)

La app manda dos mails, los dos al cliente y siempre disparados por una persona
(administrativo o supervisor), nunca solos:

| Mail | Lo dispara | Lo arma |
|---|---|---|
| Aviso de visita programada | Botón en la hoja de ruta | `sendNotificationEmails()` |
| Resultados de la visita | Botón en una visita aprobada | `sendResultsEmail()` |

El HTML de los dos vive en `plantillas.ts`, en este mismo directorio. **Es el
único lugar**: no hay copia en el panel de ningún proveedor.

## Por qué Brevo y no EmailJS

Hasta septiembre de 2026 el envío pasaba por EmailJS, que a su vez usaba un
SMTP por detrás. La cuenta terminó **suspendida** (`Account access has been
suspended`) y todos los envíos cortados.

El plan gratuito de EmailJS está pensado para mandar **desde el navegador**, con
la clave pública a la vista. Nosotros mandamos desde el servidor (la Edge
Function), que es lo correcto para no exponer credenciales, pero es justo el uso
que ese plan no contempla. Aunque reactiven la cuenta, el problema vuelve.

Brevo acepta el envío desde un servidor, son **300 mails por día gratis para
siempre**, y de paso desaparece un intermediario: el HTML pasó al código.

## Puesta en marcha

### 1. Brevo

1. Cuenta en [brevo.com](https://www.brevo.com).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** con la
   dirección desde la que salen los mails. Brevo manda un mail de confirmación a
   ese buzón: alcanza con hacer clic. **Necesita acceso al buzón, no al DNS.**
3. **Settings → SMTP & API → solapa API Keys → Generate a new API key.** Es la
   clave de la API (v3), no la SMTP key: son distintas.

### 2. Secrets de la Edge Function

En Supabase → Edge Functions → Secrets (o `npx supabase secrets set`):

| Secret | Valor | Si falta |
|---|---|---|
| `BREVO_API_KEY` | la API key v3 | no se manda nada |
| `MAIL_FROM_EMAIL` | el remitente verificado en Brevo | no se manda nada |
| `MAIL_FROM_NAME` | `Ingeniería Sol` | usa ese mismo valor |
| `MAIL_REPLY_TO` | `carlos.guinazu@ingenieriasol.com.ar` | contesta al remitente |

Los cinco secrets viejos (`EMAILJS_*`) ya no se usan y se pueden borrar.

### 3. Desplegar

```
npx supabase functions deploy send-visit-email
```

### 4. Probar

Mandar un aviso a un cliente de prueba y **revisar también la carpeta de spam**
(ver abajo).

## Lo que conviene saber

- **Sin SPF/DKIM hay más riesgo de caer en spam.** Autenticar el dominio
  requiere acceso al DNS de `ingenieriasol.com.ar`; mientras no lo haya, el
  remitente verificado funciona igual, pero conviene volver sobre esto apenas
  se pueda: es lo que de verdad mejora la entregabilidad.
- **El plan gratis agrega una línea "Sent with Brevo" al pie.** En un mail con
  membrete a un cliente se nota; se saca con el plan pago.
- **300 mails por día.** Una hoja de ruta manda uno por cliente, así que sobra,
  pero es el límite a mirar si algún día empiezan a fallar envíos.
- Brevo devuelve el motivo del rechazo en su respuesta y la función lo muestra
  tal cual en pantalla (remitente no verificado, cuota, clave inválida).

## Regla de los datos en las plantillas

- Campo terminado en **`_html`** → se arma en `index.ts`, ya escapado ahí mismo,
  y la plantilla lo inserta tal cual.
- Cualquier otro → es texto plano y **lo escapa la plantilla**.

Antes esto lo hacía EmailJS; ahora es responsabilidad nuestra. Escapar dos veces
se ve feo (`MERCEDES &amp; BENZ`); no escapar es un agujero de seguridad.

## Si hay que cambiar de proveedor

Todo el contacto con Brevo está en una sola función, `sendEmail()` en
`index.ts`: arma el pedido con destinatario, asunto y HTML. Cambiar de proveedor
es reescribir esa función y los secrets; las plantillas y la lógica no se tocan.
