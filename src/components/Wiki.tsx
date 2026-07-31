import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { OILS } from '../data/oils'
import { WAXES } from '../data/waxes'
import {
  WIKI_CATEGORIES,
  buildFullWiki,
  searchWiki,
  type WikiArticle,
  type WikiCategory,
} from '../data/wiki'
import { getPrefs, setPrefs } from '../lib/storage'

interface WikiProps {
  open: boolean
  onClose: () => void
  /** Jump to article id when opening (e.g. oil-olive) */
  initialId?: string | null
}

/** Mobile single-page breakpoint — matches CSS (no split panes). */
const MOBILE_MQ = '(max-width: 780px)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function renderBody(text: string) {
  // Split paragraphs on blank lines; keep single newlines as <br>
  const blocks = text.split(/\n\n+/)
  return blocks.map((block, i) => {
    const lines = block.split('\n')
    const isList = lines.every((l) => /^[•\-\*]/.test(l.trim()) || l.trim() === '')
    if (isList) {
      return (
        <ul key={i} className="wiki-list">
          {lines
            .filter((l) => l.trim())
            .map((l, j) => (
              <li key={j}>{l.replace(/^[•\-\*]\s*/, '')}</li>
            ))}
        </ul>
      )
    }
    // Numbered steps
    const isNum = lines.every((l) => /^\d+\./.test(l.trim()) || l.trim() === '')
    if (isNum) {
      return (
        <ol key={i} className="wiki-list wiki-list-num">
          {lines
            .filter((l) => l.trim())
            .map((l, j) => (
              <li key={j}>{l.replace(/^\d+\.\s*/, '')}</li>
            ))}
        </ol>
      )
    }
    return (
      <p key={i}>
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {formatInline(line)}
          </span>
        ))}
      </p>
    )
  })
}

function formatInline(line: string): ReactNode {
  // Very light **bold** support
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>
    }
    return p
  })
}

/** History state marker so Android/PWA system Back leaves the wiki first. */
type WikiHist = { alexWiki: true; view: 'list' | 'article'; id?: string }

function isWikiHist(s: unknown): s is WikiHist {
  return !!s && typeof s === 'object' && (s as WikiHist).alexWiki === true
}

export function Wiki({ open, onClose, initialId }: WikiProps) {
  const articles = useMemo(() => buildFullWiki(OILS, WAXES), [])
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<WikiCategory | 'all'>('all')
  const [activeId, setActiveId] = useState<string>(() => getPrefs().lastWikiId || 'welcome')
  /** Mobile: list = full-page index; article = full-page reader (no split). */
  const [mobileView, setMobileView] = useState<'list' | 'article'>('list')
  const searchRef = useRef<HTMLInputElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const openSeq = useRef(0)
  /** How many history entries this wiki session pushed (for clean dismiss). */
  const histDepthRef = useRef(0)
  /** Ignore synthetic popstate from our own history.go cleanup. */
  const ignorePopRef = useRef(false)
  const mobileViewRef = useRef(mobileView)
  const isMobileRef = useRef(isMobile)
  mobileViewRef.current = mobileView
  isMobileRef.current = isMobile

  const pushWikiHist = (view: 'list' | 'article', id?: string) => {
    const state: WikiHist = { alexWiki: true, view, id }
    window.history.pushState(state, '')
    histDepthRef.current += 1
  }

  useEffect(() => {
    if (!open) return
    openSeq.current += 1
    const seq = openSeq.current
    const id = initialId || getPrefs().lastWikiId || 'welcome'
    if (articles.some((a) => a.id === id)) setActiveId(id)

    // Deep-link / oil chip → open straight into the article on mobile.
    // Plain F1 / Wiki button → start on the full-page list.
    const jumpIn = Boolean(initialId && articles.some((a) => a.id === initialId))
    setMobileView(jumpIn ? 'article' : 'list')

    // History stack so phone system Back: article → list → calculator (not app exit).
    histDepthRef.current = 0
    pushWikiHist('list')
    if (jumpIn) pushWikiHist('article', initialId ?? id)

    const onPop = () => {
      if (ignorePopRef.current) {
        ignorePopRef.current = false
        return
      }
      histDepthRef.current = Math.max(0, histDepthRef.current - 1)

      // Still inside wiki on an article → step back to the list.
      if (isMobileRef.current && mobileViewRef.current === 'article') {
        setMobileView('list')
        window.setTimeout(() => searchRef.current?.focus(), 40)
        return
      }
      // List (or desktop) → close wiki, return to calculator.
      histDepthRef.current = 0
      onClose()
    }
    window.addEventListener('popstate', onPop)

    const t = window.setTimeout(() => {
      if (seq !== openSeq.current) return
      if (!jumpIn) searchRef.current?.focus()
    }, 60)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('popstate', onPop)
      // Closed via X / F1 / backdrop — drop wiki history entries without re-firing close.
      const depth = histDepthRef.current
      if (depth > 0) {
        ignorePopRef.current = true
        histDepthRef.current = 0
        window.history.go(-depth)
      }
    }
  }, [open, initialId, articles, onClose])

  useEffect(() => {
    if (!open) return
    setPrefs({ lastWikiId: activeId })
    articleRef.current?.scrollTo({ top: 0 })
    // When reading on mobile, also pin the single scroll container to top
    if (isMobile && mobileView === 'article' && bodyRef.current) {
      bodyRef.current.scrollTop = 0
    }
  }, [activeId, open, isMobile, mobileView])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        // Mobile article → back to list first (via history so stack stays honest)
        if (isMobile && mobileView === 'article') {
          if (isWikiHist(window.history.state) && window.history.state.view === 'article') {
            window.history.back()
          } else {
            setMobileView('list')
          }
          return
        }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, isMobile, mobileView])

  const filtered = useMemo(() => {
    let list = searchWiki(articles, query)
    if (category !== 'all') list = list.filter((a) => a.category === category)
    return list
  }, [articles, query, category])

  const active: WikiArticle | undefined = articles.find((a) => a.id === activeId)

  // Group nav by category when not searching
  const navGroups = useMemo(() => {
    if (query.trim()) {
      return [{ id: 'all' as const, label: 'Search results', icon: '⌕', items: filtered }]
    }
    return WIKI_CATEGORIES.map((c) => ({
      ...c,
      items: filtered.filter((a) => a.category === c.id),
    })).filter((g) => g.items.length > 0)
  }, [filtered, query])

  const openArticle = (id: string) => {
    setActiveId(id)
    if (!isMobile) return
    // Already reading → replace so Back still returns to list (not prior article).
    if (
      mobileView === 'article' &&
      isWikiHist(window.history.state) &&
      window.history.state.view === 'article'
    ) {
      window.history.replaceState({ alexWiki: true, view: 'article', id } satisfies WikiHist, '')
      setMobileView('article')
      return
    }
    setMobileView('article')
    pushWikiHist('article', id)
  }

  const backToList = () => {
    // Prefer history.back so Android/PWA stack matches the UI button.
    if (isWikiHist(window.history.state) && window.history.state.view === 'article') {
      window.history.back()
      return
    }
    setMobileView('list')
    window.setTimeout(() => searchRef.current?.focus(), 40)
  }

  const onTagClick = (t: string) => {
    setQuery(t)
    if (isMobile && mobileView === 'article') {
      backToList()
      return
    }
    if (isMobile) setMobileView('list')
  }

  if (!open) return null

  const showList = !isMobile || mobileView === 'list'
  const showArticle = !isMobile || mobileView === 'article'
  const panelClass =
    'wiki-panel' + (isMobile ? ` wiki-panel--mobile wiki-panel--${mobileView}` : '')

  return (
    <div className="wiki-root" role="dialog" aria-modal="true" aria-label="Craft wiki">
      <button type="button" className="wiki-backdrop" aria-label="Close wiki" onClick={onClose} />
      <div className={panelClass}>
        <header className="wiki-header">
          <div className="wiki-brand">
            {isMobile && mobileView === 'article' ? (
              <button type="button" className="wiki-back" onClick={backToList}>
                ← All articles
              </button>
            ) : (
              <span className="wiki-kicker">F1 · Craft Wiki</span>
            )}
            <h2>
              {isMobile && mobileView === 'article' && active
                ? active.title
                : "Alex's Craft Knowledge"}
            </h2>
            {!(isMobile && mobileView === 'article') && (
              <p className="wiki-sub">App help · oils · waxes · soap & candle craft</p>
            )}
          </div>
          <div className="wiki-header-actions">
            {showList && (
              <label className="wiki-search">
                <span className="sr-only">Search wiki</span>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search oils, lye, wick, FO…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            <button type="button" className="wiki-close" onClick={onClose} aria-label="Close">
              {isMobile ? 'Close' : 'Esc'}
            </button>
          </div>
        </header>

        {showList && (
          <div className="wiki-cats" role="tablist" aria-label="Wiki categories">
            <button
              type="button"
              role="tab"
              className={category === 'all' ? 'active' : ''}
              aria-selected={category === 'all'}
              onClick={() => setCategory('all')}
            >
              All
            </button>
            {WIKI_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                className={category === c.id ? 'active' : ''}
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                <span aria-hidden>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        )}

        <div
          className={
            'wiki-body' +
            (isMobile ? (mobileView === 'list' ? ' wiki-body--list' : ' wiki-body--article') : '')
          }
          ref={bodyRef}
        >
          {showList && (
            <nav className="wiki-nav" aria-label="Articles">
              {navGroups.map((g) => (
                <div key={g.id} className="wiki-nav-group">
                  <h3>
                    <span aria-hidden>{g.icon}</span> {g.label}
                    <span className="wiki-count">{g.items.length}</span>
                  </h3>
                  <ul>
                    {g.items.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={a.id === active?.id ? 'active' : ''}
                          onClick={() => openArticle(a.id)}
                        >
                          <span className="wiki-nav-title">{a.title}</span>
                          <span className="wiki-nav-sum">{a.summary}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="wiki-empty">No articles match. Try “coconut”, “trace”, or “wick”.</p>
              )}
            </nav>
          )}

          {showArticle && (
            <article className="wiki-article" ref={articleRef} key={active?.id ?? 'empty'}>
              {active ? (
                <>
                  <header className="wiki-article-head">
                    <span className="wiki-badge">
                      {WIKI_CATEGORIES.find((c) => c.id === active.category)?.label ||
                        active.category}
                    </span>
                    {/* Title lives in the panel header on mobile article view */}
                    {!(isMobile && mobileView === 'article') && <h3>{active.title}</h3>}
                    <p className="wiki-article-sum">{active.summary}</p>
                    {active.tags.length > 0 && (
                      <div className="wiki-tags">
                        {active.tags.slice(0, 8).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="wiki-tag"
                            onClick={() => onTagClick(t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </header>
                  <div className="wiki-content">
                    {active.sections.map((s, i) => (
                      <section key={i} className="wiki-section">
                        {s.heading && <h4>{s.heading}</h4>}
                        {renderBody(s.body)}
                      </section>
                    ))}
                  </div>
                  <footer className="wiki-article-foot">
                    {isMobile && (
                      <button type="button" className="wiki-back-foot" onClick={backToList}>
                        ← Back to all articles
                      </button>
                    )}
                    <p>
                      Educational craft reference — always verify SAP, IFRA, and brand TDS with your
                      suppliers. Not lab certification.
                    </p>
                  </footer>
                </>
              ) : (
                <p className="wiki-empty">Select an article.</p>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  )
}

/** Open wiki to a specific oil encyclopedia page */
export function oilWikiId(oilId: string) {
  return `oil-${oilId}`
}

export function waxWikiId(waxId: string) {
  return `wax-${waxId}`
}
