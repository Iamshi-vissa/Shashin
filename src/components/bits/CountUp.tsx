import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

/** Animates a number from its previous value to `to`. */
export function CountUp({
  to,
  duration = 1,
  className,
}: {
  to: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = String(to)
      from.current = to
      return
    }
    const controls = animate(from.current, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v))
      },
    })
    from.current = to
    return () => controls.stop()
  }, [to, duration, reduce])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}
