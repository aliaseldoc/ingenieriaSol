import { useEffect, useState } from 'react'
import { createClient, updateClient } from '../../api/clients'
import Modal from '../../components/ui/Modal'
import FormSection from '../../components/ui/FormSection'
import Field from '../../components/ui/Field'

const EMPTY_FORM = { name: '', tax_id: '', contact_name: '', contact_phone: '', contact_email: '', address: '', city: '', notes: '' }

function toFormValues(client) {
  return {
    name: client.name ?? '',
    tax_id: client.tax_id ?? '',
    contact_name: client.contact_name ?? '',
    contact_phone: client.contact_phone ?? '',
    contact_email: client.contact_email ?? '',
    address: client.address ?? '',
    city: client.city ?? '',
    notes: client.notes ?? '',
  }
}

// mode: 'create' | 'edit'. En 'edit', client es el registro a precargar.
export default function ClientFormModal({ open, mode, client, createdBy, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(mode === 'edit' && client ? toFormValues(client) : EMPTY_FORM)
    setError('')
  }, [open, mode, client])

  function handleClose() {
    if (saving) return
    onClose()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved =
        mode === 'edit' ? await updateClient(client.id, form) : await createClient({ ...form, created_by: createdBy })
      onSaved(saved)
    } catch (submitError) {
      setError(submitError.message || 'No se pudo guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'edit' ? 'Modificar Cliente' : 'Nuevo Cliente'}
      onClose={handleClose}
      size="lg"
      actions={[
        { label: 'Cancelar', variant: 'secondary-outline', onClick: handleClose, disabled: saving },
        {
          label: saving ? 'Guardando…' : 'Guardar Cliente',
          variant: 'primary',
          type: 'submit',
          form: 'client-form-modal',
          disabled: saving,
        },
      ]}
    >
      <form id="client-form-modal" onSubmit={handleSubmit} className="space-y-md">
        <FormSection title="Datos del Cliente">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Cliente" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required className="md:col-span-2" />
            <Field label="CUIT" value={form.tax_id} onChange={(v) => setForm((f) => ({ ...f, tax_id: v }))} />
            <Field label="Contacto" value={form.contact_name} onChange={(v) => setForm((f) => ({ ...f, contact_name: v }))} />
            <Field label="Teléfono" value={form.contact_phone} onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))} />
            <Field label="Email" type="email" value={form.contact_email} onChange={(v) => setForm((f) => ({ ...f, contact_email: v }))} />
            <Field label="Dirección" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
            <Field label="Ciudad" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          </div>
          <div className="space-y-xs">
            <label className="font-label-sm text-label-sm text-on-surface block">Notas</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
              className="w-full bg-surface-container-lowest border border-outline rounded-lg px-md py-sm font-body-md text-body-md text-on-surface hover:border-on-surface-variant focus:border-secondary focus:border-2 focus:outline-none transition-all resize-y"
            />
          </div>
        </FormSection>
        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
