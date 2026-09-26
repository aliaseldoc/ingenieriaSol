// Tarjeta con barra de titulo, igual a las secciones del informe de visita
// (VisitDetailPanel.jsx).
export default function RepairSection({ title, children }) {
  return (
    <section className="border border-outline-variant rounded p-md">
      <h3 className="list-title-bar -mx-md -mt-md mb-sm font-body-lg text-body-lg uppercase px-md py-sm rounded-t">{title}</h3>
      {children}
    </section>
  )
}
