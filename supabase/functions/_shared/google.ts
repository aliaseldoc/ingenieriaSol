// Acceso a las APIs de Google con una cuenta de servicio, sin librerias: el JWT
// se firma con WebCrypto y se cambia por un token de una hora. La cuenta es el
// JSON que da Google Cloud al crearle una clave, guardado como secreto de
// Supabase (nunca viaja al navegador). Para que pueda tocar un archivo, ese
// archivo se le comparte a su mail (client_email) como a cualquier persona.
import { decodeBase64 } from 'jsr:@std/encoding@1/base64'
import { encodeBase64Url } from 'jsr:@std/encoding@1/base64url'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TOKEN_LIFETIME_SECONDS = 3600

function base64UrlJson(value) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

// La clave privada viene en PEM (PKCS#8); WebCrypto la quiere en binario.
function pemToDer(pem) {
  return decodeBase64(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, ''))
}

export async function googleAccessToken(serviceAccount, scope) {
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error('La clave de la cuenta de servicio de Google está incompleta.')
  }
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64UrlJson({ alg: 'RS256', typ: 'JWT' })}.${base64UrlJson({
    iss: serviceAccount.client_email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  })}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`,
    }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.access_token) {
    throw new Error(`Google no aceptó la cuenta de servicio (${body?.error_description || body?.error || response.status}).`)
  }
  return body.access_token
}
