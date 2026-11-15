import { useEffect, useState, type MouseEvent } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { bundledAppVersion, isTauri, readAppVersion } from '../lib/appVersion'

/** Exact repo URL. GitHub accepts this casing. */
export const SOURCE_URL = 'https://github.com/AhmiDarrow/alexs-craft-calc'

interface AboutDialogProps {
  open: boolean
  onClose: () => void
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useI18n()
  const [version, setVersion] = useState(bundledAppVersion)

  useEffect(() => {
    let cancelled = false
    void readAppVersion().then((value) => {
      if (!cancelled && value) setVersion(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose])

  if (!open) return null

  function onSourceClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isTauri()) return
    event.preventDefault()
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('open_source_repo'))
      .catch(() => {
        window.open(SOURCE_URL, '_blank', 'noopener,noreferrer')
      })
  }

  return (
    <div className="about-root">
      <button type="button" className="about-backdrop" aria-label={t('about.close')} onClick={onClose} />
      <div
        className="about-panel"
        id="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <h2 id="about-title">{t('about.title')}</h2>
        <p className="about-name">Alex&apos;s Craft Calc</p>
        <p className="about-version">
          {t('about.version')} {version}
        </p>
        <p className="about-source-row">
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" onClick={onSourceClick}>
            {t('about.source')}
          </a>
        </p>
        <p className="about-signoff">{t('about.signoff')}</p>
        <div className="about-actions">
          <button type="button" className="wiki-close" onClick={onClose}>
            {t('about.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
