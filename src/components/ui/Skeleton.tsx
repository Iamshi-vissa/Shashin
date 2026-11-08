import clsx from 'clsx'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-2xl bg-card', className)} aria-hidden>
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
        style={{ animation: 'shimmer 1.4s infinite' }}
      />
    </div>
  )
}
