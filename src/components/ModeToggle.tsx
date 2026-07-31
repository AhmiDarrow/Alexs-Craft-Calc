interface ModeToggleProps {
  mode: 'soap' | 'candle'
  onChange: (mode: 'soap' | 'candle') => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="Calculator mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'soap'}
        className={mode === 'soap' ? 'active' : ''}
        onClick={() => onChange('soap')}
      >
        <span className="mode-icon" aria-hidden>
          ✦
        </span>
        Soap
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'candle'}
        className={mode === 'candle' ? 'active' : ''}
        onClick={() => onChange('candle')}
      >
        <span className="mode-icon" aria-hidden>
          ✧
        </span>
        Candle
      </button>
      <div
        className="mode-slider"
        style={{ transform: mode === 'candle' ? 'translateX(100%)' : 'translateX(0)' }}
        aria-hidden
      />
    </div>
  )
}
