/** Parse a user-typed decimal. Accepts both "." and "," without changing recipe math.
 *  Default locale is English so one-argument calls keep US thousands grouping.
 *  Empty or junk input is NaN (callers may still use `|| 0`).
 */
export function parseUserDecimal(raw: string, locale = 'en'): number {
  if (raw == null) return NaN
  let s = String(raw).trim()
  if (!s) return NaN
  s = s.replace(/[\s\u00a0\u202f\u2007\u2009]/g, '')
  s = s.replace(/’/g, "'")
  if (!/^[+-]?[\d.,']+$/.test(s)) return NaN
  s = s.replace(/'/g, '')
  if (!/^[+-]?[\d.,]+$/.test(s)) return NaN

  const sign = s.startsWith('-') ? -1 : 1
  const unsigned = s.replace(/^[+-]/, '')
  if (!unsigned || !/\d/.test(unsigned)) return NaN

  const decSep = decimalSeparator(locale)
  const normalized = normalizeUnsigned(unsigned, decSep)
  if (normalized == null) return NaN
  const n = Number(normalized)
  if (!Number.isFinite(n)) return NaN
  return sign * n
}

/** Whole counts from a decimal field. Empty or non-positive input becomes 1. */
export function countOf(raw: string, locale = 'en'): number {
  const n = parseUserDecimal(raw, locale)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

/** Decimal mark for a locale, from Intl ("," or "."). */
export function decimalSeparator(locale: string): ',' | '.' {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1.1)
    return parts.find((p) => p.type === 'decimal')?.value === ',' ? ',' : '.'
  } catch {
    return '.'
  }
}

function normalizeUnsigned(unsigned: string, decSep: ',' | '.'): string | null {
  const hasDot = unsigned.includes('.')
  const hasComma = unsigned.includes(',')

  if (hasDot && hasComma) {
    const lastDot = unsigned.lastIndexOf('.')
    const lastComma = unsigned.lastIndexOf(',')
    const dec = lastDot > lastComma ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    const withoutThou = unsigned.split(thou).join('')
    if (withoutThou.split(dec).length !== 2) return null
    return withoutThou.replace(dec, '.')
  }

  if (hasComma && !hasDot) {
    const commas = unsigned.split(',').length - 1
    if (decSep === ',') {
      if (commas > 1) {
        if (/^\d{1,3}(,\d{3})+$/.test(unsigned)) return unsigned.replace(/,/g, '')
        return null
      }
      return unsigned.replace(',', '.')
    }
    if (/^\d{1,3}(,\d{3})+$/.test(unsigned)) return unsigned.replace(/,/g, '')
    if (commas > 1) return null
    return unsigned.replace(',', '.')
  }

  if (hasDot && !hasComma) {
    const dots = unsigned.split('.').length - 1
    if (decSep === '.') {
      if (dots > 1) {
        if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) return unsigned.replace(/\./g, '')
        return null
      }
      return unsigned
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) return unsigned.replace(/\./g, '')
    if (dots > 1) return null
    return unsigned
  }

  return unsigned
}
