import { useRef, type ReactNode } from 'react'

/** A card with a soft warm spotlight that follows the finger/cursor (React Bits "SpotlightCard"). */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--sx', `${e.clientX - r.left}px`)
    el.style.setProperty('--sy', `${e.clientY - r.top}px`)
    el.style.setProperty('--so', '1')
  }
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={() => ref.current?.style.setProperty('--so', '0')}
      className={`relative overflow-hidden rounded-3xl border border-line bg-card ${className ?? ''}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
        style={{
          opacity: 'var(--so, 0)',
          background:
            'radial-gradient(260px circle at var(--sx) var(--sy), rgba(255,216,77,0.14), transparent 70%)',
        }}
      />
      {children}
    </div>
  )
}
