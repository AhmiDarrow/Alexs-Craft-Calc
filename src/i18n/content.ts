import { ADDITIVES, type Additive } from '../data/additives'
import { KOH_FACTOR, OILS, type Oil } from '../data/oils'
import { WAXES, type Wax } from '../data/waxes'
import type { WikiArticle } from '../data/wiki'
import { formatNumber, formatTempF } from './format'
import { humanizeTrait, tagKey } from './tagKey'
import type { TFunction } from './translate'

/** Catalog lookup that keeps the English source when a key was never shipped. */
export function tx(t: TFunction, key: string, fallback: string): string {
  const value = t(key)
  return value === key ? fallback : value
}

export function displayTag(t: TFunction, tag: string): string {
  const oil = OILS.find((item) => item.id === tag || item.name.toLowerCase() === tag.toLowerCase())
  if (oil) return tx(t, `oil.${oil.id}.name`, oil.name)
  const wax = WAXES.find((item) => item.id === tag || item.name.toLowerCase() === tag.toLowerCase())
  if (wax) return tx(t, `wax.${wax.id}.name`, wax.name)
  const keys = [
    `trait.${tag}`,
    `oilCat.${tag}`,
    `waxType.${tag}`,
    `wiki.cat.${tag}`,
    `bestFor.${tagKey(tag)}`,
    `tag.${tagKey(tag)}`,
  ]
  for (const key of keys) {
    const value = t(key)
    if (value !== key) return value
  }
  return tag
}

function clip(text: string, max: number): string {
  const chars = [...text]
  return chars.length <= max ? text : chars.slice(0, max).join('')
}

function formatFixed(n: number, locale: string, places: number): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    }).format(n)
  } catch {
    return n.toFixed(places)
  }
}

function levelText(t: TFunction, value: string): string {
  return tx(t, `level.${value}`, value)
}

export function localizeOil(t: TFunction, oil: Oil): Oil {
  return {
    ...oil,
    name: tx(t, `oil.${oil.id}.name`, oil.name),
    notes: oil.notes ? tx(t, `oil.${oil.id}.notes`, oil.notes) : oil.notes,
    wiki: oil.wiki ? tx(t, `oil.${oil.id}.wiki`, oil.wiki) : oil.wiki,
  }
}

export function localizeWax(t: TFunction, wax: Wax): Wax {
  return {
    ...wax,
    name: tx(t, `wax.${wax.id}.name`, wax.name),
    notes: wax.notes ? tx(t, `wax.${wax.id}.notes`, wax.notes) : wax.notes,
    wiki: wax.wiki ? tx(t, `wax.${wax.id}.wiki`, wax.wiki) : wax.wiki,
    cureDays: wax.cureDays ? tx(t, `wax.${wax.id}.cure`, wax.cureDays) : wax.cureDays,
    wickNotes: wax.wickNotes ? tx(t, `wax.${wax.id}.wick`, wax.wickNotes) : wax.wickNotes,
  }
}

export function localizeAdditive(t: TFunction, add: Additive): Additive {
  return {
    ...add,
    name: tx(t, `additive.${add.id}.name`, add.name),
    phase: tx(t, `additive.${add.id}.phase`, add.phase),
    benefits: tx(t, `additive.${add.id}.benefits`, add.benefits),
    cautions: add.cautions ? tx(t, `additive.${add.id}.cautions`, add.cautions) : add.cautions,
    waterNote: add.waterNote ? tx(t, `additive.${add.id}.water`, add.waterNote) : add.waterNote,
    lyeNote: add.lyeNote ? tx(t, `additive.${add.id}.lye`, add.lyeNote) : add.lyeNote,
    wiki: tx(t, `additive.${add.id}.wiki`, add.wiki),
    ppo: add.ppo ? tx(t, `additive.${add.id}.ppo`, add.ppo) : add.ppo,
  }
}

export function oilDisplayName(t: TFunction, id: string, fallback?: string): string {
  const oil = OILS.find((item) => item.id === id)
  if (!oil) return fallback || id
  return tx(t, `oil.${oil.id}.name`, oil.name)
}

export function waxDisplayName(t: TFunction, id: string, fallback?: string): string {
  const wax = WAXES.find((item) => item.id === id)
  if (!wax) return fallback || id
  return tx(t, `wax.${wax.id}.name`, wax.name)
}

export function additiveDisplayName(t: TFunction, id: string, fallback?: string): string {
  const add = ADDITIVES.find((item) => item.id === id)
  if (!add) return fallback || id
  return tx(t, `additive.${add.id}.name`, add.name)
}

function localizeOilArticle(t: TFunction, locale: string, oil: Oil): WikiArticle {
  const shown = localizeOil(t, oil)
  const name = shown.name
  const notes = shown.notes?.trim() ?? ''
  const wiki = shown.wiki?.trim() ?? ''
  const summary = notes
    ? notes
    : wiki
      ? clip(wiki, 90)
      : t('spec.oilFallbackSummary', { name })
  const lines = [
    t('spec.naohSap', {
      sap: formatNumber(oil.sapNaoh, locale, 4),
      koh: formatFixed(oil.sapNaoh * KOH_FACTOR, locale, 4),
    }),
  ]
  if (oil.iodine != null) lines.push(t('spec.iodine', { value: formatNumber(oil.iodine, locale, 4) }))
  if (oil.ins != null) lines.push(t('spec.ins', { value: formatNumber(oil.ins, locale, 4) }))
  if (oil.maxPct != null) lines.push(t('spec.maxPct', { pct: formatNumber(oil.maxPct, locale, 2) }))
  if (oil.hardness) lines.push(t('spec.hardness', { value: levelText(t, oil.hardness) }))
  if (oil.conditioning) lines.push(t('spec.conditioning', { value: levelText(t, oil.conditioning) }))
  if (oil.lather) lines.push(t('spec.lather', { value: levelText(t, oil.lather) }))
  if (oil.traits?.length) {
    const list = oil.traits.map((trait) => tx(t, `trait.${trait}`, humanizeTrait(trait))).join(t('spec.listSep'))
    lines.push(t('spec.traits', { list }))
  }
  if (notes) lines.push(t('spec.shortNote', { note: notes }))
  return {
    id: `oil-${oil.id}`,
    title: name,
    category: 'oils',
    tags: [oil.name.toLowerCase(), oil.id, oil.category, ...(oil.traits ?? []), 'oil', 'sap'],
    summary,
    sections: [
      { body: wiki || t('spec.oilFallbackBody', { name }) },
      { heading: t('spec.heading'), body: lines.join('\n') },
    ],
  }
}

function localizeWaxArticle(t: TFunction, locale: string, wax: Wax): WikiArticle {
  const shown = localizeWax(t, wax)
  const name = shown.name
  const notes = shown.notes?.trim() ?? ''
  const wiki = shown.wiki?.trim() ?? ''
  const summary = notes
    ? notes
    : wiki
      ? clip(wiki, 90)
      : t('spec.waxFallbackSummary', { name })
  const lines = [
    t('spec.type', { value: tx(t, `waxType.${wax.type}`, wax.type) }),
    t('spec.foBand', {
      min: formatNumber(wax.fragranceMin, locale, 2),
      max: formatNumber(wax.fragranceMax, locale, 2),
      typical: formatNumber(wax.fragranceTypical, locale, 2),
    }),
  ]
  if (wax.meltPointF != null) lines.push(t('spec.melt', { temp: formatTempF(wax.meltPointF, locale) }))
  if (wax.pourTempF != null) lines.push(t('spec.pour', { temp: formatTempF(wax.pourTempF, locale) }))
  if (shown.cureDays) lines.push(t('spec.cure', { text: shown.cureDays }))
  if (wax.bestFor?.length) {
    const list = wax.bestFor.map((use) => tx(t, `bestFor.${tagKey(use)}`, use)).join(t('spec.listSep'))
    lines.push(t('spec.bestFor', { list }))
  }
  if (shown.wickNotes) lines.push(t('spec.wick', { text: shown.wickNotes }))
  if (notes) lines.push(t('spec.shortNote', { note: notes }))
  return {
    id: `wax-${wax.id}`,
    title: name,
    category: 'waxes',
    tags: [wax.name.toLowerCase(), wax.id, wax.type, 'wax', 'candle', 'fo'],
    summary,
    sections: [
      { body: wiki || t('spec.waxFallbackBody', { name }) },
      { heading: t('spec.heading'), body: lines.join('\n') },
    ],
  }
}

function localizeStatic(t: TFunction, article: WikiArticle): WikiArticle {
  return {
    ...article,
    title: tx(t, `wiki.${article.id}.title`, article.title),
    summary: tx(t, `wiki.${article.id}.summary`, article.summary),
    sections: article.sections.map((section, index) => ({
      heading: section.heading
        ? tx(t, `wiki.${article.id}.s${index}.heading`, section.heading)
        : undefined,
      body: tx(t, `wiki.${article.id}.s${index}.body`, section.body),
    })),
  }
}

/** Localized copy of a full wiki list. Tag ids stay stable for search. */
export function localizeArticles(t: TFunction, locale: string, articles: WikiArticle[]): WikiArticle[] {
  return articles.map((article) => {
    if (article.id.startsWith('oil-')) {
      const oil = OILS.find((item) => item.id === article.id.slice(4))
      return oil ? localizeOilArticle(t, locale, oil) : localizeStatic(t, article)
    }
    if (article.id.startsWith('wax-')) {
      const wax = WAXES.find((item) => item.id === article.id.slice(4))
      return wax ? localizeWaxArticle(t, locale, wax) : localizeStatic(t, article)
    }
    return localizeStatic(t, article)
  })
}

function wickSizeKey(diameter: number): string {
  if (diameter < 1.5) return 'wick.size.lt15'
  if (diameter < 2) return 'wick.size.lt20'
  if (diameter < 2.5) return 'wick.size.lt25'
  if (diameter < 3) return 'wick.size.lt30'
  if (diameter < 3.5) return 'wick.size.lt35'
  if (diameter < 4) return 'wick.size.lt40'
  return 'wick.size.multi'
}

/** Wick sentence for the UI. Pass the engine string only to detect the empty-wax case. */
export function formatWickHint(
  diameterIn: number,
  wax: Wax | null | undefined,
  t: TFunction,
  locale: string,
): string {
  if (!Number.isFinite(diameterIn) || diameterIn <= 0) return t('wick.needDiameter')
  const size = t(wickSizeKey(diameterIn))
  const series = t('wick.series')
  const d = formatNumber(diameterIn, locale, 2)
  if (wax) {
    return t('wick.line', { d, wax: tx(t, `wax.${wax.id}.name`, wax.name), size, series })
  }
  return t('wick.lineNoWax', { d, size, series })
}

export function formatPourHint(wax: Wax | null | undefined, t: TFunction, locale: string): string {
  if (!wax) return ''
  const bits: string[] = []
  if (wax.pourTempF) bits.push(t('pour.typical', { temp: formatTempF(wax.pourTempF, locale) }))
  if (wax.meltPointF) bits.push(t('pour.melt', { temp: formatTempF(wax.meltPointF, locale) }))
  let text = bits.join(t('pour.sep'))
  if (wax.notes) {
    const notes = tx(t, `wax.${wax.id}.notes`, wax.notes)
    text = text ? `${text}${t('pour.sep')}${notes}` : notes
  }
  return text
}

export function vesselLabel(t: TFunction, id: string, fallback: string): string {
  return tx(t, `vessel.${id}`, fallback)
}
