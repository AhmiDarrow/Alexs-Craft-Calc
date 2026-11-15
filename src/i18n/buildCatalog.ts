import { ADDITIVES } from '../data/additives'
import { OILS } from '../data/oils'
import { VESSEL_PRESETS, WAXES } from '../data/waxes'
import { WIKI_ARTICLES, buildFullWiki } from '../data/wiki'
import { QUALITY_DEFS } from '../lib/soapCalc'
import { humanizeTrait, tagKey } from './tagKey'
import type { Catalog } from './translate'
import { UI_EN } from './ui-en'

const OIL_CATS = new Set<string>(['hard', 'soft', 'butter', 'specialty', 'liquid'])
const WIKI_CATS = new Set<string>(['start', 'app', 'soap', 'oils', 'candle', 'waxes', 'safety', 'reference'])
const RESERVED_TAGS = new Set<string>(['oil', 'sap', 'wax', 'candle', 'fo'])

/**
 * English catalog. UI strings come from ui-en.ts.
 * Oils, waxes, additives, vessels, quality copy, and wiki bodies are copied
 * from the data modules so the calculator keeps one source of truth.
 */
export function buildCatalog(): Catalog {
  const cat: Catalog = { ...UI_EN }
  const put = (key: string, value: string | undefined | null) => {
    if (value == null) return
    if (!String(value).trim()) return
    if (Object.prototype.hasOwnProperty.call(cat, key)) return
    cat[key] = String(value)
  }

  for (const oil of OILS) {
    put(`oil.${oil.id}.name`, oil.name)
    put(`oil.${oil.id}.notes`, oil.notes)
    put(`oil.${oil.id}.wiki`, oil.wiki)
    for (const trait of oil.traits ?? []) put(`trait.${trait}`, humanizeTrait(trait))
  }

  for (const wax of WAXES) {
    put(`wax.${wax.id}.name`, wax.name)
    put(`wax.${wax.id}.notes`, wax.notes)
    put(`wax.${wax.id}.wiki`, wax.wiki)
    put(`wax.${wax.id}.cure`, wax.cureDays)
    put(`wax.${wax.id}.wick`, wax.wickNotes)
    for (const use of wax.bestFor ?? []) put(`bestFor.${tagKey(use)}`, use)
  }

  for (const vessel of VESSEL_PRESETS) put(`vessel.${vessel.id}`, vessel.label)

  for (const add of ADDITIVES) {
    put(`additive.${add.id}.name`, add.name)
    put(`additive.${add.id}.phase`, add.phase)
    put(`additive.${add.id}.benefits`, add.benefits)
    put(`additive.${add.id}.cautions`, add.cautions)
    put(`additive.${add.id}.water`, add.waterNote)
    put(`additive.${add.id}.lye`, add.lyeNote)
    put(`additive.${add.id}.wiki`, add.wiki)
    put(`additive.${add.id}.ppo`, add.ppo)
  }

  for (const metric of QUALITY_DEFS) {
    put(`quality.${metric.key}.label`, metric.label)
    put(`quality.${metric.key}.hint`, metric.hint)
  }

  for (const article of WIKI_ARTICLES) {
    put(`wiki.${article.id}.title`, article.title)
    put(`wiki.${article.id}.summary`, article.summary)
    article.sections.forEach((section, index) => {
      if (section.heading) put(`wiki.${article.id}.s${index}.heading`, section.heading)
      put(`wiki.${article.id}.s${index}.body`, section.body)
    })
  }

  const oilIds = new Set(OILS.map((oil) => oil.id))
  const oilNames = new Set(OILS.map((oil) => oil.name.toLowerCase()))
  const traits = new Set<string>(OILS.flatMap((oil) => oil.traits ?? []))
  const waxIds = new Set(WAXES.map((wax) => wax.id))
  const waxNames = new Set(WAXES.map((wax) => wax.name.toLowerCase()))
  const waxTypes = new Set<string>(WAXES.map((wax) => wax.type))
  const bestFor = new Set<string>(WAXES.flatMap((wax) => wax.bestFor ?? []))

  for (const article of buildFullWiki(OILS, WAXES)) {
    for (const tag of article.tags) {
      if (RESERVED_TAGS.has(tag)) continue
      if (oilIds.has(tag) || oilNames.has(tag.toLowerCase())) continue
      if (waxIds.has(tag) || waxNames.has(tag.toLowerCase())) continue
      if (traits.has(tag) || OIL_CATS.has(tag) || waxTypes.has(tag)) continue
      if (WIKI_CATS.has(tag) || bestFor.has(tag)) continue
      put(`tag.${tagKey(tag)}`, tag)
    }
  }

  return cat
}

export function sortedCatalog(catalog: Catalog = buildCatalog()): Catalog {
  const out: Catalog = {}
  for (const key of Object.keys(catalog).sort()) out[key] = catalog[key]
  return out
}
