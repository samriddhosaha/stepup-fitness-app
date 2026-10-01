import {
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

// Shared form primitives. Every control has a visible label, announces its state to
// assistive tech, and links its error text with aria-describedby.

const controlBase =
  'w-full rounded-lg border bg-elevated text-ink placeholder:text-faint min-h-12 focus:outline-2 focus:outline-offset-2'
const controlTone = (error?: string | null) =>
  error ? 'border-danger focus:outline-danger' : 'border-line focus:outline-accent'

function Describe({ id, error, hint }: { id: string; error?: string | null; hint?: string }) {
  if (error) {
    return (
      <span id={id} role="alert" className="block text-xs font-semibold text-danger mt-1.5">
        {error}
      </span>
    )
  }
  return hint ? (
    <span id={id} className="block text-xs text-faint mt-1.5">
      {hint}
    </span>
  ) : null
}

export function FieldGroup({ legend, children, className = '' }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="label-eyebrow text-faint mb-2 p-0">{legend}</legend>
      {children}
    </fieldset>
  )
}

/** Single choice from a small set. Radiogroup semantics with arrow-key navigation. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  layout = 'row',
  className = '',
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
  layout?: 'row' | 'column'
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((o) => o.value === value)

  function onKeyDown(e: KeyboardEvent, index: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (index + dir + options.length) % options.length
    onChange(options[next]!.value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-2 ${layout === 'column' ? 'flex-col' : 'flex-wrap'} ${className}`}
    >
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`rounded-lg px-4 min-h-12 text-sm font-semibold border border-line transition-colors flex items-center ${
              layout === 'column' ? 'justify-start text-left px-5' : 'justify-center'
            } ${checked ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-surface'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** One option of a multi-select group. Conveys state with aria-pressed, not colour alone. */
export function ToggleChip({
  pressed,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`rounded-lg px-4 min-h-12 text-sm font-semibold border border-line transition-colors flex items-center gap-2 ${
        pressed ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-surface'
      } ${className}`}
      {...props}
    >
      <span aria-hidden="true" className="font-mono text-xs">
        {pressed ? '✓' : '+'}
      </span>
      {children}
    </button>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  step,
  min,
  max,
  inputMode = 'decimal',
  stepper = false,
  centered = false,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'step'> & {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | null
  hint?: string
  step?: number
  stepper?: boolean
  centered?: boolean
}) {
  const uid = useId()
  const describedBy = error || hint ? `${uid}-d` : undefined

  function bump(dir: 1 | -1) {
    const current = value.trim() === '' ? 0 : Number(value)
    const base = Number.isFinite(current) ? current : 0
    const next = Math.round((base + dir * (step ?? 1)) * 100) / 100
    const clamped = Math.min(Number(max ?? Infinity), Math.max(Number(min ?? -Infinity), next))
    onChange(String(clamped))
  }

  const input = (
    <input
      id={uid}
      type="number"
      inputMode={inputMode}
      step="any" // steppers use `step`; typing must accept any decimal
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      className={`${controlBase} ${controlTone(error)} px-3 py-3 ${centered ? 'text-center text-lg font-semibold' : 'px-4'} ${className}`}
      {...props}
    />
  )

  return (
    <div className="block">
      <label htmlFor={uid} className="label-eyebrow block text-ink mb-1.5">
        {label}
      </label>
      {stepper ? (
        <span className="flex gap-1.5">
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => bump(-1)}
            className="shrink-0 w-11 min-h-12 rounded-lg border border-line bg-elevated font-semibold hover:bg-surface"
          >
            −
          </button>
          {input}
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => bump(1)}
            className="shrink-0 w-11 min-h-12 rounded-lg border border-line bg-elevated font-semibold hover:bg-surface"
          >
            +
          </button>
        </span>
      ) : (
        input
      )}
      <Describe id={`${uid}-d`} error={error} hint={hint} />
    </div>
  )
}

export function TextArea({
  label,
  hint,
  error,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | null }) {
  const uid = useId()
  const describedBy = error || hint ? `${uid}-d` : undefined
  return (
    <label className="block">
      <span className="label-eyebrow block text-ink mb-2">{label}</span>
      <textarea
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${controlBase} ${controlTone(error)} px-4 py-3 min-h-24 ${className}`}
        {...props}
      />
      <Describe id={`${uid}-d`} error={error} hint={hint} />
    </label>
  )
}

export function Select({
  label,
  options,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="label-eyebrow block text-ink mb-1.5">{label}</span>
      <select className={`${controlBase} ${controlTone()} px-3 font-semibold ${className}`} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
