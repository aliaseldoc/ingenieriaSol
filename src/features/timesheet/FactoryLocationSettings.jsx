import { useState } from 'react'
import Button from '../../components/ui/Button'
import Field from '../../components/ui/Field'
import FormSection from '../../components/ui/FormSection'
import { saveTimesheetSettings } from '../../api/timesheetSettings'
import { DEFAULT_FACTORY_RADIUS_M, LOCATION_ERROR_LABELS, LOCATION_STATUS } from '../../lib/constants'
import { getCurrentLocation } from './geolocation'
import { hasFactoryLocation, mapsUrl, parseCoordinates } from './geo'

function toFormValues(settings) {
  return {
    factoryName: settings?.factory_name ?? '',
    coordinates: hasFactoryLocation(settings) ? `${settings.factory_latitude}, ${settings.factory_longitude}` : '',
    radius: String(settings?.factory_radius_m ?? DEFAULT_FACTORY_RADIUS_M),
  }
}

// Ubicacion y radio de la fabrica, para la leyenda "Fichado fuera de rango"
// que el supervisor ve en los fichajes por app.
export default function FactoryLocationSettings({ settings, actorId, onSaved }) {
  const [form, setForm] = useState(() => toFormValues(settings))
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { error, text }

  const parsedCoordinates = parseCoordinates(form.coordinates)

  async function handleUseCurrentLocation() {
    setLocating(true)
    setMessage(null)
    const location = await getCurrentLocation()
    setLocating(false)
    if (location.status !== LOCATION_STATUS.OK) {
      setMessage({ error: true, text: `${LOCATION_ERROR_LABELS[location.error]}. Podés pegar las coordenadas desde Google Maps.` })
      return
    }
    setForm((current) => ({ ...current, coordinates: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` }))
    setMessage({ error: false, text: `Ubicación tomada (precisión ±${Math.round(location.accuracy)} m). Guardá para confirmarla.` })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const radiusMeters = Number(form.radius)
    if (!parsedCoordinates) {
      setMessage({ error: true, text: 'Las coordenadas no son válidas. Usá el formato "-34.6037, -58.3816".' })
      return
    }
    if (!Number.isInteger(radiusMeters) || radiusMeters <= 0) {
      setMessage({ error: true, text: 'El radio debe ser un número entero de metros mayor a 0.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const saved = await saveTimesheetSettings(
        { factoryName: form.factoryName.trim(), latitude: parsedCoordinates.latitude, longitude: parsedCoordinates.longitude, radiusMeters },
        actorId
      )
      setForm(toFormValues(saved))
      setMessage({ error: false, text: 'Ubicación de la fábrica guardada.' })
      await onSaved()
    } catch (error) {
      setMessage({ error: true, text: error?.message || 'No se pudo guardar la ubicación.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[64rem] bg-surface-container-lowest border border-outline-variant rounded-lg p-md md:p-xl">
      <form onSubmit={handleSubmit} className="space-y-xl">
        <FormSection title="Ubicación de la Fábrica">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Los fichajes hechos desde la app a más distancia que el radio se marcan como "Fichado fuera de rango". Es solo informativo:
            no bloquea el fichaje ni cambia las horas.
          </p>
          <Field label="Nombre" value={form.factoryName} onChange={(value) => setForm((current) => ({ ...current, factoryName: value }))} />
          <div className="space-y-sm">
            <Field
              label="Coordenadas (latitud, longitud)"
              value={form.coordinates}
              onChange={(value) => setForm((current) => ({ ...current, coordinates: value }))}
              required
            />
            <div className="flex flex-wrap items-center gap-sm">
              <Button variant="secondary-outline" icon="my_location" onClick={handleUseCurrentLocation} disabled={locating}>
                {locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
              </Button>
              {parsedCoordinates && (
                <a
                  href={mapsUrl(parsedCoordinates.latitude, parsedCoordinates.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-label-md text-label-md text-secondary underline"
                >
                  Ver en mapa
                </a>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              También podés copiar las coordenadas desde Google Maps (clic derecho sobre el punto) y pegarlas acá.
            </p>
          </div>
          <Field
            label="Radio en metros"
            type="number"
            value={form.radius}
            onChange={(value) => setForm((current) => ({ ...current, radius: value }))}
            required
          />
        </FormSection>

        {message && (
          <p role="alert" className={`font-body-sm text-body-sm ${message.error ? 'text-error' : 'text-secondary'}`}>
            {message.text}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon="save" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar ubicación'}
          </Button>
        </div>
      </form>
    </div>
  )
}
