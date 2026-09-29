import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const base =
    'brutal-press inline-flex items-center justify-center gap-2 rounded-sm border-2 border-ink px-6 min-h-12 text-[0.95rem] font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none'
  const variants: Record<string, string> = {
    primary: 'bg-accent text-white brutal-shadow',
    secondary: 'bg-elevated text-ink brutal-shadow',
    ghost: 'bg-transparent text-ink hover:bg-hairline/40',
    danger: 'bg-danger text-white brutal-shadow',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm bg-elevated border-2 border-ink p-5 ${className}`}>{children}</div>
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
      className={`rounded-sm px-4 min-h-12 text-sm font-bold border-2 border-ink transition-colors flex items-center justify-center ${
        active ? 'bg-accent text-white' : 'bg-elevated text-ink hover:bg-hairline/40'
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
        className={`w-full rounded-sm border-2 bg-elevated px-4 py-3 text-ink placeholder:text-faint min-h-12 focus:outline-2 focus:outline-offset-2 ${
          error ? 'border-danger focus:outline-danger' : 'border-ink focus:outline-accent'
        }`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? (
        <span className="block text-xs font-bold text-danger mt-1.5">{error}</span>
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
      <div className="flex-1 h-2 border-2 border-ink overflow-hidden">
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
    <div className="text-center py-10 px-4 border-2 border-dashed border-hairline">
      <p className="font-display font-bold text-xl mb-2">{title}</p>
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
          className={`w-3 h-3 border-2 border-ink ${i < done ? 'bg-accent' : 'bg-elevated'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
