import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { RefreshCw } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

const THRESHOLD = 70

/** Pull down at the top of the page to refresh. */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>
  children: ReactNode
}) {
  const y = useMotionValue(0)
  const rotate = useTransform(y, [0, THRESHOLD], [0, 270])
  const opacity = useTransform(y, [0, THRESHOLD * 0.6], [0, 1])
  const start = useRef<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  return (
    <div
      onTouchStart={(e) => {
        start.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null
      }}
      onTouchMove={(e) => {
        if (start.current === null) return
        const d = e.touches[0].clientY - start.current
        y.set(d > 0 ? Math.min(d * 0.5, THRESHOLD * 1.4) : 0)
      }}
      onTouchEnd={async () => {
        if (start.current === null) return
        start.current = null
        if (y.get() >= THRESHOLD) {
          setRefreshing(true)
          void animate(y, THRESHOLD * 0.8)
          try {
            await onRefresh()
          } finally {
            setRefreshing(false)
            void animate(y, 0)
          }
        } else {
          void animate(y, 0)
        }
      }}
    >
      <motion.div style={{ height: y }} className="flex items-end justify-center overflow-hidden">
        <motion.span style={{ rotate, opacity }} className="mb-3 text-accent">
          <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
        </motion.span>
      </motion.div>
      {children}
    </div>
  )
}
