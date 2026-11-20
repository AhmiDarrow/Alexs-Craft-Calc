import { ADDITIVES } from '../data/additives'
import { WAXES } from '../data/waxes'
import { formatNumber } from './format'
import { tx } from './content'
import type { TFunction } from './translate'

const EXACT: Record<string, string> = {
  'Add at least one oil with a weight greater than zero.': 'warn.needOil',
  'High lauric oils (>40%) can be drying — consider higher superfat or more conditioning oils.':
    'warn.lauric',
  'Superfat under 3% leaves little buffer for measurement error.': 'warn.sfLow',
  'Superfat over 10% may soften the bar and shorten shelf life.': 'warn.sfHigh',
  'High iodine value — bar may go rancid faster; cure well and store cool.': 'warn.iodine',
  'Enter a wax weight greater than zero.': 'warn.needWax',
  'Enter wax weight to get wick guidance.': 'warn.needWaxForWick',
  'Set vessel diameter for a rough single-wick starting point (always test burn).': 'wick.needDiameter',
  'Storage is not available in this environment': 'err.storageUnavailable',
  'Storage full — export a backup, then delete old recipes': 'err.storageFull',
  'Storage blocked (private / restricted mode)': 'err.storageBlocked',
  'Could not save to local storage': 'err.storageSave',
  'File is empty': 'err.emptyFile',
  'Not valid JSON': 'err.badJson',
  'Invalid recipe file': 'err.invalidRecipe',
  'Recipe file has no valid recipes': 'err.noValidRecipes',
  'No recognized recipes in file': 'err.noRecognized',
  'Unrecognized recipe format': 'err.unrecognizedFormat',
  'Could not read that file': 'err.readFile',
  'Read failed': 'err.readFailed',
  'Load failed': 'err.loadFailed',
  'Shared recipe file': 'share.sharedFile',
  'Share cancelled': 'share.cancelled',
  'Shared via device share sheet': 'share.sharedSheet',
  'Recipe JSON copied — paste into a file or message': 'share.copiedJson',
  'Could not share or download recipe': 'share.failed',
  'No saved recipes to share': 'share.none',
  'Nothing new to import': 'import.nothing',
}

function numText(raw: string, locale: string, places: number): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  return formatNumber(n, locale, places)
}

function additiveName(english: string, t: TFunction): string {
  const add = ADDITIVES.find((item) => item.name === english)
  return add ? tx(t, `additive.${add.id}.name`, add.name) : english
}

function waxName(english: string, t: TFunction): string {
  const wax = WAXES.find((item) => item.name === english)
  return wax ? tx(t, `wax.${wax.id}.name`, wax.name) : english
}

function unitText(unit: string, t: TFunction): string {
  if (unit === 'g' || unit === 'oz' || unit === 'lb' || unit === 'tsp' || unit === 'tbsp') {
    return t(`unit.${unit}`)
  }
  return unit
}

/**
 * Translate an English string returned by the calc engine or storage.
 * Unrecognized text is returned unchanged so a new engine sentence still shows.
 */
export function localizeRuntimeMessage(message: string, t: TFunction, locale: string): string {
  const exact = EXACT[message]
  if (exact) return t(exact)

  let match = /^Unknown oil id: (.+)$/.exec(message)
  if (match) return t('warn.unknownOil', { id: match[1] })

  match = /^(.+): below recommended usage \((.+)% vs (.+)–(.+)% of oils\)\.$/.exec(message)
  if (match) {
    return t('warn.usageBelow', {
      name: additiveName(match[1], t),
      pct: numText(match[2], locale, 1),
      min: numText(match[3], locale, 2),
      max: numText(match[4], locale, 2),
    })
  }

  match = /^(.+): above recommended usage \((.+)% vs (.+)–(.+)% of oils\)\.$/.exec(message)
  if (match) {
    return t('warn.usageAbove', {
      name: additiveName(match[1], t),
      pct: numText(match[2], locale, 1),
      min: numText(match[3], locale, 2),
      max: numText(match[4], locale, 2),
    })
  }

  match = /^Citric acid: added (.+) ([^\s]+) of (NaOH|KOH) to compensate for the acid\.$/.exec(message)
  if (match) {
    return t('warn.citric', {
      amount: numText(match[1], locale, 2),
      unit: unitText(match[2], t),
      lye: match[3],
    })
  }

  match = /^Fragrance (.+)% is below typical min \((.+)%\) for (.+) — scent may be weak\.$/.exec(message)
  if (match) {
    return t('warn.foBelow', {
      pct: numText(match[1], locale, 2),
      min: numText(match[2], locale, 2),
      name: waxName(match[3], t),
    })
  }

  match = /^Fragrance (.+)% exceeds typical max \((.+)%\) for (.+) — risk of sweating \/ poor burn\.$/.exec(
    message,
  )
  if (match) {
    return t('warn.foAbove', {
      pct: numText(match[1], locale, 2),
      max: numText(match[2], locale, 2),
      name: waxName(match[3], t),
    })
  }

  match = /^Downloaded (.+)$/.exec(message)
  if (match) return t('share.downloaded', { filename: match[1] })

  return message
}

type ImportCounts = {
  soapSaved: number
  candleSaved: number
  soapUpdated?: number
  candleUpdated?: number
}

function plural(t: TFunction, locale: string, stem: string, n: number): string {
  let category = 'other'
  try {
    category = new Intl.PluralRules(locale).select(n)
  } catch {
    category = 'other'
  }
  const nText = formatNumber(n, locale, 0)
  for (const cat of [category, 'other', 'one']) {
    const key = `${stem}.${cat}`
    const value = t(key, { n: nText })
    if (value !== key) return value
  }
  return nText
}

/** Toast text from import counts. The English storage summary stays untouched. */
export function localizeImportSummary(merged: ImportCounts, t: TFunction, locale: string): string {
  const parts: string[] = []
  const soapNew = merged.soapSaved
  const soapUp = merged.soapUpdated || 0
  const candleNew = merged.candleSaved
  const candleUp = merged.candleUpdated || 0
  if (soapNew) parts.push(plural(t, locale, 'import.newSoap', soapNew))
  if (soapUp) parts.push(plural(t, locale, 'import.updatedSoap', soapUp))
  if (candleNew) parts.push(plural(t, locale, 'import.newCandle', candleNew))
  if (candleUp) parts.push(plural(t, locale, 'import.updatedCandle', candleUp))
  if (!parts.length) return t('import.nothing')
  return t('import.imported', { parts: parts.join(t('import.joiner')) })
}

export function importHasChanges(merged: ImportCounts): boolean {
  return (
    merged.soapSaved +
      merged.candleSaved +
      (merged.soapUpdated || 0) +
      (merged.candleUpdated || 0) >
    0
  )
}
