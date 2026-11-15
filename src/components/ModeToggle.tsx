import { useI18n } from '../i18n/I18nProvider'

interface ModeToggleProps {
  mode: 'soap' | 'candle'
  onChange: (mode: 'soap' | 'candle') => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const { t } = useI18n()
  return (
    <div className="mode-toggle" role="tablist" aria-label={t('mode.aria')}>
      <button
        type="button"
        role="tab"
        id="mode-tab-soap"
        aria-controls="mode-panel-soap"
        aria-selected={mode === 'soap'}
        tabIndex={mode === 'soap' ? 0 : -1}
        className={mode === 'soap' ? 'active' : ''}
        onClick={() => onChange('soap')}
      >
        <span className="mode-icon" aria-hidden>
          ✦
        </span>
        {t('mode.soap')}
      </button>
      <button
        type="button"
        role="tab"
        id="mode-tab-candle"
        aria-controls="mode-panel-candle"
        aria-selected={mode === 'candle'}
        tabIndex={mode === 'candle' ? 0 : -1}
        className={mode === 'candle' ? 'active' : ''}
        onClick={() => onChange('candle')}
      >
        <span className="mode-icon" aria-hidden>
          ✧
        </span>
        {t('mode.candle')}
      </button>
      <div
        className="mode-slider"
        style={{ transform: mode === 'candle' ? 'translateX(100%)' : 'translateX(0)' }}
        aria-hidden
      />
    </div>
  )
}
