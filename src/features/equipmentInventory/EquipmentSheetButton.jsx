import { useState } from 'react'
import { getEquipmentById } from '../../api/equipment'
import Button from '../../components/ui/Button'
import EquipmentHistoryPanel from './EquipmentHistoryPanel'

// "Ver Ficha Técnica" del informe de una visita. La visita trae embebidos solo
// algunos datos del equipo, asi que la ficha completa se pide recien al abrirla
// (mismo criterio que el boton del tecnico en VisitFormPage.jsx).
export default function EquipmentSheetButton({ equipmentId }) {
  const [equipment, setEquipment] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleOpen() {
    setLoading(true)
    try {
      setEquipment(await getEquipmentById(equipmentId))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="secondary-outline" icon="precision_manufacturing" onClick={handleOpen} disabled={loading}>
        {loading ? 'Cargando…' : 'Ver Ficha Técnica'}
      </Button>
      <EquipmentHistoryPanel
        equipment={equipment}
        onClose={() => setEquipment(null)}
        onUpdated={setEquipment}
        onDeleted={() => setEquipment(null)}
      />
    </>
  )
}
