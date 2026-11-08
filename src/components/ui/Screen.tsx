import type { ReactNode } from 'react'

/** Standard screen layout: sticky title bar + content padded for the safe area and Dock. */
export function Screen({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      <header
        className="sticky top-0 z-30 flex items-end justify-between gap-3 bg-bg/80 px-5 pb-3 backdrop-blur-xl"
        style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}
      >
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <main
        className="px-5"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--dock-h) + 40px)' }}
      >
        {children}
      </main>
    </div>
  )
}
