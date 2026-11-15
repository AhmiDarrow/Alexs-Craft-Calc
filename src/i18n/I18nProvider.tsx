import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PREFS_KEY, setPrefs } from '../lib/storage'
import { buildCatalog } from './buildCatalog'
import { htmlLang, isLocaleId, LOCALE_LIST, resolveStoredLocale, type LocaleId } from './locales'
import { translate, type TFunction, type TranslateVars } from './translate'
import de from './locales/de.json' with { type: 'json' }
import enJson from './locales/en.json' with { type: 'json' }
import es from './locales/es.json' with { type: 'json' }
import fr from './locales/fr.json' with { type: 'json' }
import it from './locales/it.json' with { type: 'json' }
import ja from './locales/ja.json' with { type: 'json' }
import ko from './locales/ko.json' with { type: 'json' }
import pl from './locales/pl.json' with { type: 'json' }
import ptBR from './locales/pt-BR.json' with { type: 'json' }
import ru from './locales/ru.json' with { type: 'json' }
import zhCN from './locales/zh-CN.json' with { type: 'json' }

type Catalog = Record<string, string>

const ENGLISH = buildCatalog()

function asCatalog(value: object): Catalog {
  const out: Catalog = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') out[key] = item
  }
  return out
}

const CATALOGS: Record<LocaleId, Catalog> = {
  en: ENGLISH,
  es: asCatalog(es),
  fr: asCatalog(fr),
  de: asCatalog(de),
  'pt-BR': asCatalog(ptBR),
  it: asCatalog(it),
  ru: asCatalog(ru),
  pl: asCatalog(pl),
  ja: asCatalog(ja),
  ko: asCatalog(ko),
  'zh-CN': asCatalog(zhCN),
}

function browserTags(): string[] {
  try {
    if (typeof navigator === 'undefined') return ['en']
    if (navigator.languages?.length) return [...navigator.languages]
    return [navigator.language || 'en']
  } catch {
    return ['en']
  }
}

function readInitialLocale(): LocaleId {
  let raw: string | null = null
  try {
    if (typeof localStorage !== 'undefined') raw = localStorage.getItem(PREFS_KEY)
  } catch {
    raw = null
  }
  const decided = resolveStoredLocale(raw, browserTags())
  if (decided.persist) {
    try {
      localStorage.setItem(PREFS_KEY, decided.persist)
    } catch {
      /* keep the choice for this session even if storage is blocked */
    }
  }
  return decided.locale
}

function applyDocument(locale: LocaleId, t: TFunction) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = htmlLang(locale)
  document.title = t('app.documentTitle')
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', t('app.description'))
}

interface I18nContextValue {
  locale: LocaleId
  intlLocale: string
  locales: { id: LocaleId; nativeName: string }[]
  setLocale: (next: string) => void
  t: TFunction
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(readInitialLocale)
  const t = useCallback<TFunction>(
    (key: string, vars?: TranslateVars) => translate(CATALOGS[locale], ENGLISH, key, vars),
    [locale],
  )
  const setLocale = useCallback((next: string) => {
    if (!isLocaleId(next)) return
    setLocaleState(next)
    setPrefs({ locale: next })
  }, [])

  useEffect(() => {
    applyDocument(locale, t)
  }, [locale, t])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      intlLocale: htmlLang(locale),
      locales: LOCALE_LIST,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

/** Referenced so a stale en.json is still typechecked alongside the live catalog. */
export const ENGLISH_JSON_KEY_COUNT = Object.keys(enJson).length
