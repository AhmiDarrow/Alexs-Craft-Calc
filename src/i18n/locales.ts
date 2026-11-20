/** Supported locales. English is the source catalog and the runtime fallback. */
export const LOCALE_IDS = [
  'en',
  'es',
  'fr',
  'de',
  'pt-BR',
  'it',
  'ru',
  'pl',
  'ja',
  'ko',
  'zh-CN',
] as const

export type LocaleId = (typeof LOCALE_IDS)[number]

export const LOCALE_LIST: { id: LocaleId; nativeName: string }[] = [
  { id: 'en', nativeName: 'English' },
  { id: 'es', nativeName: 'Español' },
  { id: 'fr', nativeName: 'Français' },
  { id: 'de', nativeName: 'Deutsch' },
  { id: 'pt-BR', nativeName: 'Português (Brasil)' },
  { id: 'it', nativeName: 'Italiano' },
  { id: 'ru', nativeName: 'Русский' },
  { id: 'pl', nativeName: 'Polski' },
  { id: 'ja', nativeName: '日本語' },
  { id: 'ko', nativeName: '한국어' },
  { id: 'zh-CN', nativeName: '中文（简体）' },
]

const ID_SET = new Set<string>(LOCALE_IDS)

export function isLocaleId(value: string): value is LocaleId {
  return ID_SET.has(value)
}

/** BCP 47 tag stored on <html lang> and passed to Intl. */
export function htmlLang(locale: LocaleId): string {
  return locale
}

/**
 * Pick a supported locale from navigator.languages order.
 * pt and pt-* map to pt-BR (only Brazilian Portuguese is shipped).
 * zh, zh-CN, zh-Hans, and zh-SG map to zh-CN.
 * zh-TW, zh-HK, zh-MO, and zh-Hant do not map to Simplified Chinese.
 */
export function matchLocale(tags: readonly string[]): LocaleId {
  for (const raw of tags) {
    const tag = String(raw || '')
      .trim()
      .replace(/_/g, '-')
    if (!tag) continue
    const lower = tag.toLowerCase()
    const exact = LOCALE_IDS.find((id) => id.toLowerCase() === lower)
    if (exact) return exact
    if (
      lower === 'zh' ||
      lower.startsWith('zh-cn') ||
      lower.startsWith('zh-hans') ||
      lower.startsWith('zh-sg')
    ) {
      return 'zh-CN'
    }
    if (
      lower.startsWith('zh-tw') ||
      lower.startsWith('zh-hk') ||
      lower.startsWith('zh-mo') ||
      lower.startsWith('zh-hant')
    ) {
      continue
    }
    if (lower.startsWith('pt')) return 'pt-BR'
    const primary = lower.split('-')[0]
    if (primary === 'en') return 'en'
    if (primary === 'es') return 'es'
    if (primary === 'fr') return 'fr'
    if (primary === 'de') return 'de'
    if (primary === 'it') return 'it'
    if (primary === 'ru') return 'ru'
    if (primary === 'pl') return 'pl'
    if (primary === 'ja') return 'ja'
    if (primary === 'ko') return 'ko'
  }
  return 'en'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Decide the locale for this profile.
 * `persist` is the full prefs JSON to write, or null when storage must be left alone
 * (already chosen, or the existing JSON is corrupt).
 */
export function resolveStoredLocale(
  raw: string | null,
  tags: readonly string[],
): { locale: LocaleId; persist: string | null } {
  if (raw == null) {
    const locale = matchLocale(tags)
    return { locale, persist: JSON.stringify({ locale }) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { locale: matchLocale(tags), persist: null }
  }
  if (!isRecord(parsed)) return { locale: matchLocale(tags), persist: null }
  const saved = typeof parsed.locale === 'string' ? parsed.locale : ''
  if (isLocaleId(saved)) return { locale: saved, persist: null }
  const locale = matchLocale(tags)
  return { locale, persist: JSON.stringify({ ...parsed, locale }) }
}
