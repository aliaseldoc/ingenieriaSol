import Logo from './Logo'

export default function LoginCard({ children }) {
  return (
    <div className="animate-login-rise w-full max-w-[32rem] bg-surface-container-lowest border border-outline-variant shadow-elevation-2 rounded-lg overflow-hidden">
      <div className="m-[0.3rem] border border-outline-variant/60 rounded-[0.4rem] overflow-hidden flex flex-col">
        <div className="bg-primary-container p-xl flex flex-col items-center justify-center border-b border-outline-variant">
          <h1 className="w-full">
            <Logo className="w-[21rem] mx-auto text-on-primary" />
          </h1>
        </div>
        <div className="p-xl flex flex-col gap-lg">{children}</div>
        <div className="bg-surface-container-low p-md border-t border-outline-variant text-center">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-[0.1em]">
            Solo personal autorizado · Sistema monitoreado
          </p>
        </div>
      </div>
    </div>
  )
}
