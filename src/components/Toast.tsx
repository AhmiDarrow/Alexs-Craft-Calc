import { useEffect } from 'react'

interface ToastProps {
  message: string | null
  onDone: () => void
}

function toastTone(message: string): 'ok' | 'warn' | 'err' {
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

export function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDone, toastMs(message))
    return () => window.clearTimeout(t)
  }, [message, onDone])

  if (!message) return null
  const tone = toastTone(message)
  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
