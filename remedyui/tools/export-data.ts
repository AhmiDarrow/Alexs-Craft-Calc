// Writes the shipped app's reference data (src/data/*.ts) as JSON for the RemedyUI app.
// The TypeScript files stay the single source of truth: run `npx tsx remedyui/tools/export-data.ts`
// after editing them; `cargo test` (data_matches_export) fails if the JSON is stale.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OILS, OIL_FATTY_ACIDS, KOH_FACTOR, KOH_PURITY } from '../../src/data/oils'
import { ADDITIVES, ADDITIVE_CATEGORY_LABELS, DEFAULT_G_PER_TSP } from '../../src/data/additives'
import { WAXES, VESSEL_PRESETS } from '../../src/data/waxes'
import { WIKI_ARTICLES, WIKI_CATEGORIES } from '../../src/data/wiki'
import { QUALITY_DEFS } from '../../src/lib/soapCalc'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const write = (name: string, value: unknown) =>
  writeFileSync(join(out, name), JSON.stringify(value, null, 1) + '\n', 'utf8')

write('oils.json', { kohFactor: KOH_FACTOR, kohPurity: KOH_PURITY, oils: OILS, fattyAcids: OIL_FATTY_ACIDS })
write('additives.json', {
  defaultGPerTsp: DEFAULT_G_PER_TSP,
  categories: Object.entries(ADDITIVE_CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
  additives: ADDITIVES,
})
write('waxes.json', { waxes: WAXES, vessels: VESSEL_PRESETS })
write('quality.json', { qualities: QUALITY_DEFS })
write('wiki.json', { categories: WIKI_CATEGORIES, articles: WIKI_ARTICLES })
