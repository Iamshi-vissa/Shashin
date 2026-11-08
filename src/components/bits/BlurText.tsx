import { motion } from 'motion/react'

/** Letters fade in from a blur, one after another (React Bits "BlurText" style). */
export function BlurText({
  text,
  className,
  delay = 0.06,
}: {
  text: string
  className?: string
  delay?: number
}) {
  return (
    <span className={className} aria-label={text} role="text">
      {[...text].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, filter: 'blur(10px)', y: -12 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ delay: i * delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  )
}
