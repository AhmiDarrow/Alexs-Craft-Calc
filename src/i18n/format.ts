import { decimalSeparator, parseUserDecimal } from '../lib/parseDecimal'

/** User-visible number. Grouping follows the locale. */
export function formatNumber(n: number, locale: string, places = 2): string {
  if (!Number.isFinite(n)) return formatNumber(0, locale, places)
  const rounded = Math.round(n * 10 ** places) / 10 ** places
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: places,
    }).format(rounded)
  } catch {
    return String(rounded)
  }
}

/** Temperature for display. English stays °F. Other locales add a rounded °C equivalent. */
export function formatTempF(f: number, locale: string): string {
  const fText = formatNumber(f, locale, 0)
  if (locale.toLowerCase() === 'en' || locale.toLowerCase().startsWith('en-')) return `${fText}°F`
  const c = Math.round(((f - 32) * 5) / 9)
  return `${fText}°F (${formatNumber(c, locale, 0)}°C)`
}

/**
 * Number typed into an input. No grouping, so a later parse round-trips.
 * Comma locales get a comma decimal (35.274 → "35,274"), never a fake thousands dot.
 */
export function formatEditable(n: number, locale: string, places = 4): string {
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 10 ** places) / 10 ** places
  const negative = rounded < 0
  const fixed = Math.abs(rounded).toFixed(places)
  const trimmed = fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const sep = decimalSeparator(locale)
  const body = sep === '.' ? trimmed : trimmed.replace('.', sep)
  return negative ? `-${body}` : body
}

export function reformatEditable(
  raw: string,
  fromLocale: string,
  toLocale: string,
  places: number,
): string {
  if (!raw.trim()) return raw
  const n = parseUserDecimal(raw, fromLocale)
  if (!Number.isFinite(n)) return raw
  return formatEditable(n, toLocale, places)
}
