import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}
export type ToastFn = (message: string, action?: ToastAction) => void

export const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
