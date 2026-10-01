import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './ui'
import { ToastContext, type ToastAction, type ToastFn } from './toastContext'

/**
 * Modal built on the native <dialog>: it traps focus, closes on Esc and returns focus to
 * whatever opened it. Renders as a bottom sheet on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '') // very old engines / jsdom
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close()
      else el.removeAttribute('open')
    }
  }, [open])

  // Always mounted (closed) so the browser can hand focus back to the opener on close.
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault() // we own the state; closing is done by the parent
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // backdrop click
      }}
      className="m-auto md:m-auto max-md:mb-0 max-md:mt-auto w-full max-w-lg rounded-lg border border-line bg-elevated text-ink p-0 backdrop:bg-ink/50 max-md:rounded-b-none"
    >
      <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <h2 id={titleId} className="font-display font-semibold text-xl mb-3">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      {body && <div className="text-sm text-faint mb-4">{body}</div>}
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}

interface ToastItem {
  id: number
  message: string
  action?: ToastAction
}

/** Quiet confirmation messages in a polite live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const toast = useCallback<ToastFn>((message, action) => {
    const id = nextId.current++
    setItems((list) => [...list, { id, message, action }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), action ? 8000 : 4500)
  }, [])

  const value = useMemo(() => toast, [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-24 md:bottom-8 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {items.map((t) => (
          <p
            key={t.id}
            className="pointer-events-auto flex items-center gap-4 rounded-lg border border-line bg-elevated shadow-soft-sm px-4 py-3 text-sm font-semibold max-w-sm"
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="font-semibold underline min-h-11 px-1"
                onClick={() => {
                  t.action?.onClick()
                  setItems((list) => list.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
