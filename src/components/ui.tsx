import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-pill px-6 min-h-12 text-[0.95rem] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none'
  const variants: Record<string, string> = {
    primary: 'bg-accent text-white hover:opacity-90',
    secondary: 'bg-accent-soft text-accent hover:opacity-90',
    ghost: 'bg-transparent text-ink border border-line hover:bg-hairline',
    danger: 'bg-danger text-white hover:opacity-90',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-elevated border border-hairline p-5 ${className}`}>
      {children}
    </div>
  )
}

export function PillChip({
  active,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-pill px-4 min-h-12 text-sm font-medium border transition-colors flex items-center justify-center ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-elevated text-ink border-line hover:border-accent'
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
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      <input
        className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-ink placeholder:text-faint min-h-12 focus:outline-2 focus:outline-accent"
        {...props}
      />
      {hint && <span className="block text-xs text-faint mt-1.5">{hint}</span>}
    </label>
  )
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
      <span className="text-xs font-medium text-faint whitespace-nowrap">
        Step {step} of {total}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-hairline overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-[width]"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="font-display text-xl mb-2">{title}</p>
      <p className="text-faint text-sm max-w-sm mx-auto">{body}</p>
    </div>
  )
}

export function WeekDots({ done, planned }: { done: number; planned: number }) {
  const total = Math.max(planned, done, 1)
  return (
    <div className="flex items-center gap-1.5" aria-label={`${done} of ${planned} sessions done this week`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i < done ? 'bg-accent' : 'bg-hairline'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
