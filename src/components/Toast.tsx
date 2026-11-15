import { useEffect } from 'react'

export type ToastTone = 'ok' | 'warn' | 'err'
export type ToastFn = (msg: string, tone?: ToastTone) => void

interface ToastProps {
  message: string | null
  tone?: ToastTone
  onDone: () => void
}

/** Fallback when a caller still passes English text without an explicit tone. */
function toastTone(message: string): ToastTone {
  const m = message.toLowerCase()
  if (
    m.includes('fail') ||
    m.includes('could not') ||
    m.includes('blocked') ||
    m.includes('storage full') ||
    m.includes('not valid') ||
    m.includes('empty') ||
    m.includes('unrecognized') ||
    m.includes('no valid') ||
    m.includes('no recognized') ||
    m.includes('pop-up')
  ) {
    return 'err'
  }
  if (
    m.includes('must') ||
    m.includes('before') ||
    m.includes('nothing new') ||
    m.includes('no saved')
  ) {
    return 'warn'
  }
  return 'ok'
}

/** Longer copy gets a bit more dwell time so users can read import summaries. */
function toastMs(message: string): number {
  const len = message.length
  if (len > 72) return 4200
  if (len > 40) return 3200
  return 2400
}

export function Toast({ message, tone, onDone }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const dwell = window.setTimeout(onDone, toastMs(message))
    return () => window.clearTimeout(dwell)
  }, [message, onDone])

  if (!message) return null
  const resolved = tone ?? toastTone(message)
  return (
    <div className={`toast toast-${resolved}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
