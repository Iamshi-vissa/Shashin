import { useReducedMotion } from 'motion/react'
import { useRef, type ReactNode } from 'react'

/** Little sparks burst from the tap point (React Bits "ClickSpark" style). */
export function ClickSpark({
  children,
  color = '#FFD84D',
  count = 10,
  className,
}: {
  children: ReactNode
  color?: string
  count?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  const burst = (e: React.PointerEvent) => {
    if (reduce) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const start = performance.now()
    const dur = 450
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const ease = 1 - (1 - t) ** 3
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const r1 = 8 + ease * 34
        const len = 10 * (1 - ease)
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1)
        ctx.lineTo(x + Math.cos(a) * (r1 + len), y + Math.sin(a) * (r1 + len))
        ctx.stroke()
      }
      if (t < 1) requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, rect.width, rect.height)
    }
    requestAnimationFrame(draw)
  }

  return (
    <div className={`relative ${className ?? ''}`} onPointerDown={burst}>
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute -inset-12 h-[calc(100%+6rem)] w-[calc(100%+6rem)]"
      />
    </div>
  )
}
