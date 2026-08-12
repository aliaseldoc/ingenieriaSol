import { useLayoutEffect, useRef, useState } from 'react'

// Umbral de desplazamiento para distinguir un tap (dispara onClick) de un
// arrastre (solo reposiciona) — sin esto, cada intento de mover el boton
// terminaria ademas disparando la accion.
const DRAG_THRESHOLD_PX = 6
const MARGIN_PX = 16
// Alto de MobileTabBar (h-[6.4rem], solo visible por debajo de md) — se
// resta del limite inferior para que nunca se pueda arrastrar el boton
// encima de la barra de navegacion.
const MOBILE_TAB_BAR_HEIGHT_PX = 64
const MOBILE_BREAKPOINT_PX = 768

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getBounds(width, height) {
  const bottomReserved = window.innerWidth < MOBILE_BREAKPOINT_PX ? MOBILE_TAB_BAR_HEIGHT_PX + MARGIN_PX : MARGIN_PX
  return {
    minX: MARGIN_PX,
    maxX: window.innerWidth - width - MARGIN_PX,
    minY: MARGIN_PX,
    maxY: window.innerHeight - height - bottomReserved,
  }
}

// Boton flotante y arrastrable (ej. "Guardar Borrador"): queda siempre
// visible mientras se scrollea el formulario, y el tecnico puede moverlo a
// cualquier parte de la pantalla. Posicion en estado local del propio
// componente — no se persiste entre visitas (VisitFormPage remonta por
// visitId de ruta, asi que siempre arranca en la esquina por defecto).
export default function DraggableFab({ onClick, label, icon, disabled }) {
  const nodeRef = useRef(null)
  const dragStateRef = useRef(null)
  const [position, setPosition] = useState({ x: MARGIN_PX, y: MARGIN_PX })

  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const bounds = getBounds(node.offsetWidth, node.offsetHeight)
    setPosition({ x: bounds.minX, y: bounds.maxY })

    function handleResize() {
      setPosition((current) => {
        const nextBounds = getBounds(node.offsetWidth, node.offsetHeight)
        return { x: clamp(current.x, nextBounds.minX, nextBounds.maxX), y: clamp(current.y, nextBounds.minY, nextBounds.maxY) }
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // Solo al montar: la posicion despues es responsabilidad del arrastre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePointerDown(event) {
    if (disabled) return
    event.preventDefault()
    nodeRef.current.setPointerCapture(event.pointerId)
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, moved: false }
  }

  function handlePointerMove(event) {
    const dragState = dragStateRef.current
    if (!dragState) return
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    if (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX) dragState.moved = true
    const node = nodeRef.current
    const bounds = getBounds(node.offsetWidth, node.offsetHeight)
    setPosition({
      x: clamp(dragState.originX + deltaX, bounds.minX, bounds.maxX),
      y: clamp(dragState.originY + deltaY, bounds.minY, bounds.maxY),
    })
  }

  function handlePointerUp(event) {
    const dragState = dragStateRef.current
    dragStateRef.current = null
    if (!dragState) return
    nodeRef.current.releasePointerCapture(event.pointerId)
    if (!dragState.moved) onClick?.()
  }

  return (
    <button
      ref={nodeRef}
      type="button"
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none', left: `${position.x}px`, top: `${position.y}px` }}
      className={`fixed z-[45] flex items-center gap-sm rounded-full py-sm px-lg shadow-elevation-2 font-label-md text-label-md bg-secondary text-on-secondary transition-colors select-none ${
        disabled ? 'opacity-50' : 'hover:bg-secondary-container cursor-grab active:cursor-grabbing'
      }`}
    >
      <span className="material-symbols-outlined text-[1.8rem]">{icon}</span>
      {label}
    </button>
  )
}
