import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}) {
  const base =
    'press inline-flex items-center justify-center gap-2 rounded-lg border border-line px-6 min-h-12 text-[0.95rem] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none'
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-accent text-on-accent',
    secondary: 'bg-elevated text-ink',
    ghost: 'bg-transparent text-ink hover:bg-surface',
    danger: 'bg-danger text-on-danger',
  }
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-line p-5 shadow-soft-sm ${/bg-/.test(className) ? '' : 'bg-elevated'} ${className}`}
    >
      {children}
    </div>
  )
}

export function Chip({
  active,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-4 min-h-12 text-sm font-semibold border border-line transition-colors flex items-center justify-center ${
        active ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-surface'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function TextField({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="label-eyebrow block text-ink mb-2">{label}</span>
      <input
        className={`w-full rounded-lg border bg-elevated px-4 py-3 text-ink placeholder:text-faint min-h-12 focus:outline-2 focus:outline-offset-2 ${
          error ? 'border-danger focus:outline-danger' : 'border-line focus:outline-accent'
        }`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? (
        <span className="block text-xs font-semibold text-danger mt-1.5">{error}</span>
      ) : (
        hint && <span className="block text-xs text-faint mt-1.5">{hint}</span>
      )}
    </label>
  )
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      <span className="label-eyebrow whitespace-nowrap">
        Step {step} / {total}
      </span>
      <div className="flex-1 h-2 rounded-full border border-line overflow-hidden">
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-line rounded-lg">
      <p className="font-display font-semibold text-xl mb-2">{title}</p>
      <p className="text-faint text-sm max-w-sm mx-auto">{body}</p>
    </div>
  )
}

export function WeekDots({ done, planned }: { done: number; planned: number }) {
  const total = Math.max(planned, done, 1)
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={`${done} of ${planned} sessions done this week`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full border border-line ${i < done ? 'bg-accent' : 'bg-elevated'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

/** Placeholder block shown while data loads, instead of a blank screen. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-hairline/60 ${className}`} />
}

export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
    </div>
  )
}
