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

export function Wiki({ open, onClose, initialId }: WikiProps) {
  const articles = useMemo(() => buildFullWiki(OILS, WAXES), [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<WikiCategory | 'all'>('all')
  const [activeId, setActiveId] = useState<string>(() => getPrefs().lastWikiId || 'welcome')
  const searchRef = useRef<HTMLInputElement>(null)
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const id = initialId || getPrefs().lastWikiId || 'welcome'
    if (articles.some((a) => a.id === id)) setActiveId(id)
    // Focus search shortly after open for keyboard users
    const t = window.setTimeout(() => searchRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [open, initialId, articles])

  useEffect(() => {
    if (!open) return
    setPrefs({ lastWikiId: activeId })
    articleRef.current?.scrollTo({ top: 0 })
  }, [activeId, open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    let list = searchWiki(articles, query)
    if (category !== 'all') list = list.filter((a) => a.category === category)
    return list
  }, [articles, query, category])

  const active: WikiArticle | undefined =
    articles.find((a) => a.id === activeId) || filtered[0] || articles[0]

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

  if (!open) return null

  return (
    <div className="wiki-root" role="dialog" aria-modal="true" aria-label="Craft wiki">
      <button type="button" className="wiki-backdrop" aria-label="Close wiki" onClick={onClose} />
      <div className="wiki-panel">
        <header className="wiki-header">
          <div className="wiki-brand">
            <span className="wiki-kicker">F1 · Craft Wiki</span>
            <h2>Alien Craft Knowledge</h2>
            <p className="wiki-sub">App help · oils · waxes · soap & candle craft</p>
          </div>
          <div className="wiki-header-actions">
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
            <button type="button" className="wiki-close" onClick={onClose} aria-label="Close">
              Esc
            </button>
          </div>
        </header>

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

        <div className="wiki-body">
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
                        onClick={() => setActiveId(a.id)}
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

          <article className="wiki-article" ref={articleRef} key={active?.id}>
            {active ? (
              <>
                <header className="wiki-article-head">
                  <span className="wiki-badge">
                    {WIKI_CATEGORIES.find((c) => c.id === active.category)?.label || active.category}
                  </span>
                  <h3>{active.title}</h3>
                  <p className="wiki-article-sum">{active.summary}</p>
                  {active.tags.length > 0 && (
                    <div className="wiki-tags">
                      {active.tags.slice(0, 8).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="wiki-tag"
                          onClick={() => setQuery(t)}
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
