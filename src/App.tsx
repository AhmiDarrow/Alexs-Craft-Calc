import { useCallback, useEffect, useState } from 'react'
import { ModeToggle } from './components/ModeToggle'
import { SoapCalculator } from './components/SoapCalculator'
import { CandleCalculator } from './components/CandleCalculator'
import { Wiki } from './components/Wiki'
import { Toast } from './components/Toast'
import './App.css'
import './wiki-polish.css'

type Mode = 'soap' | 'candle'

const MODE_KEY = 'alien-craft-mode'

function readMode(): Mode {
  try {
    if (typeof localStorage === 'undefined') return 'soap'
    return localStorage.getItem(MODE_KEY) === 'candle' ? 'candle' : 'soap'
  } catch {
    return 'soap'
  }
}

function writeMode(mode: Mode) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* private mode / blocked storage — mode still works in-session */
  }
}

export default function App() {
  const [mode, setMode] = useState<Mode>(() => readMode())
  const [wikiOpen, setWikiOpen] = useState(false)
  const [wikiId, setWikiId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    writeMode(mode)
    document.documentElement.dataset.mode = mode
  }, [mode])

  const openWiki = useCallback((articleId?: string) => {
    setWikiId(articleId ?? null)
    setWikiOpen(true)
  }, [])

  const closeWiki = useCallback(() => {
    setWikiOpen(false)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // F1 opens wiki — prevent browser help
      if (e.key === 'F1') {
        e.preventDefault()
        setWikiOpen((v) => {
          if (v) return false
          setWikiId(null)
          return true
        })
        return
      }
      // Ctrl+/ or Cmd+/ also toggles help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setWikiOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lock body scroll when wiki open
  useEffect(() => {
    if (wikiOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [wikiOpen])

  const showToast = useCallback((msg: string) => setToast(msg), [])

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-a" aria-hidden />
      <div className="bg-orb bg-orb-b" aria-hidden />
      <div className="bg-orb bg-orb-c" aria-hidden />
      <div className="bg-grid" aria-hidden />

      <header className="app-header">
        <div className="brand">
          <img
            src="./brand-soap.png"
            alt=""
            className="brand-mark"
            width={44}
            height={44}
            onError={(e) => {
              const el = e.currentTarget
              // Fall back to SVG mark, then initials
              if (!el.dataset.fallback) {
                el.dataset.fallback = '1'
                el.src = './brand-mark.svg'
                return
              }
              el.style.display = 'none'
              const fallback = el.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'grid'
            }}
          />
          <div className="brand-mark brand-mark-fallback" style={{ display: 'none' }} aria-hidden>
            AX
          </div>
          <div>
            <h1>Alex&apos;s Craft Calc</h1>
            <p className="tagline">Soap · Candle · Precision in purple</p>
          </div>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="help-btn"
            onClick={() => openWiki()}
            title="Craft wiki (F1)"
            aria-keyshortcuts="F1"
          >
            <span className="help-key">F1</span>
            <span>Wiki</span>
          </button>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      <div className="hero-strip" aria-hidden>
        <img src="./banner-art.png" alt="" className="hero-banner" />
      </div>

      <main
        className="app-main"
        key={mode}
        id={mode === 'soap' ? 'mode-panel-soap' : 'mode-panel-candle'}
        role="tabpanel"
        aria-labelledby={mode === 'soap' ? 'mode-tab-soap' : 'mode-tab-candle'}
      >
        {mode === 'soap' ? (
          <SoapCalculator onOpenWiki={openWiki} onToast={showToast} />
        ) : (
          <CandleCalculator onOpenWiki={openWiki} onToast={showToast} />
        )}
      </main>

      <footer className="app-footer">
        <p>
          Everyday craft math · NaOH/KOH SAP · fragrance loads · press{' '}
          <button type="button" className="footer-f1" onClick={() => openWiki()}>
            F1
          </button>{' '}
          for the craft wiki · works offline as an installed app
        </p>
        <p className="disclaimer">
          Always verify SAP values with your oil supplier. Lye is caustic — wear PPE. Fragrance %
          limits vary by IFRA and wax brand.
        </p>
      </footer>

      <Wiki open={wikiOpen} onClose={closeWiki} initialId={wikiId} />
      <Toast message={toast} onDone={() => setToast(null)} />

      <button
        type="button"
        className="fab-help"
        onClick={() => openWiki()}
        aria-label="Open craft wiki"
        title="Craft wiki (F1)"
      >
        ?
      </button>
    </div>
  )
}
