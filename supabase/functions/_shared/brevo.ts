// Envio de mails por Brevo, compartido por las Edge Functions que mandan
// correo (send-visit-email y cierre-semanal). Todo el contacto con el
// proveedor esta aca: cambiar de proveedor es reescribir esta funcion y los
// secrets, sin tocar plantillas ni logica.

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
// Direccion verificada en Brevo desde la que salen los mails.
const MAIL_FROM_EMAIL = Deno.env.get('MAIL_FROM_EMAIL')
const MAIL_FROM_NAME = Deno.env.get('MAIL_FROM_NAME') ?? 'Ingeniería Sol'
// A donde contesta el destinatario si responde el mail.
const MAIL_REPLY_TO = Deno.env.get('MAIL_REPLY_TO') ?? MAIL_FROM_EMAIL

// `to` acepta una direccion o varias. `attachments`: [{ name, contentBase64 }].
export async function sendEmail({ to, subject, html, attachments = [] }) {
  if (!BREVO_API_KEY || !MAIL_FROM_EMAIL) {
    throw new Error('Falta configurar BREVO_API_KEY y MAIL_FROM_EMAIL como secrets de la Edge Function.')
  }
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }))
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: MAIL_FROM_EMAIL, name: MAIL_FROM_NAME },
      to: recipients,
      replyTo: { email: MAIL_REPLY_TO },
      subject,
      htmlContent: html,
      ...(attachments.length > 0
        ? { attachment: attachments.map(({ name, contentBase64 }) => ({ name, content: contentBase64 })) }
        : {}),
    }),
  })
  if (!response.ok) {
    // Brevo explica el motivo en JSON ("sender not valid", cuota, etc.): se
    // muestra ese texto y no el volcado entero, que nadie puede interpretar.
    const cuerpo = await response.text()
    let detalle = cuerpo
    try {
      detalle = JSON.parse(cuerpo).message ?? cuerpo
    } catch {
      // Se queda con el texto crudo.
    }
    throw new Error(`Brevo rechazó el envío: ${detalle}`)
  }
}
