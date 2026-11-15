export type Catalog = Record<string, string>
export type TranslateVars = Record<string, string | number>
export type TFunction = (key: string, vars?: TranslateVars) => string

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g

/** Missing or blank translations fall back to English, then to the key. Never throws. */
export function translate(
  catalog: Catalog,
  english: Catalog,
  key: string,
  vars?: TranslateVars,
): string {
  const primary = pick(catalog, key)
  const raw = primary ?? pick(english, key) ?? key
  if (!vars) return raw
  return raw.replace(PLACEHOLDER, (whole, name: string) => {
    const value = vars[name]
    return value == null ? whole : String(value)
  })
}

function pick(catalog: Catalog, key: string): string | undefined {
  const value = catalog[key]
  if (typeof value !== 'string') return undefined
  if (value.trim() === '') return undefined
  return value
}

export function placeholderNames(text: string): string[] {
  const names = new Set<string>()
  for (const match of text.matchAll(PLACEHOLDER)) names.add(match[1])
  return [...names].sort()
}
