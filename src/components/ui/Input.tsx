import clsx from 'clsx'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: boolean }
>(function Input({ label, hint, error, className, id, ...rest }, ref) {
  const inputId = id ?? `in-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <input
        ref={ref}
        id={inputId}
        {...rest}
        className={clsx(
          'h-12 w-full rounded-2xl border bg-card px-4 text-[16px] text-ink outline-none transition placeholder:text-muted/60 focus:border-accent',
          error ? 'border-danger' : 'border-line',
          className,
        )}
      />
      {hint && <span className="mt-1.5 block text-[12px]">{hint}</span>}
    </label>
  )
})
