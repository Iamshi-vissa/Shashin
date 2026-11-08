import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

export interface DockItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  primary?: boolean
}

/** Floating bottom tab bar with a sliding highlight (React Bits "Dock" feel). */
export function Dock({ items }: { items: DockItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
    >
      <div className="flex items-center gap-1 rounded-[28px] border border-line bg-card/85 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {items.map(({ to, label, icon: Icon, badge, primary }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={badge ? `${label}, ${badge} new` : label}
            className="relative flex h-14 w-[68px] flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-medium"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="dock-active"
                    className={`absolute inset-0 rounded-[22px] ${primary ? 'bg-accent' : 'bg-card-2'}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <motion.span
                  whileTap={{ scale: 0.85 }}
                  className={`relative flex flex-col items-center gap-0.5 ${
                    isActive
                      ? primary
                        ? 'text-accent-ink'
                        : 'text-ink'
                      : primary
                        ? 'text-accent'
                        : 'text-muted'
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </motion.span>
                {!!badge && (
                  <span className="absolute right-2.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
