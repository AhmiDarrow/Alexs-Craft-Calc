// Generates tests/fixtures/legacy-localstorage.json: localStorage exactly as the shipped app
// leaves it after people save, update, delete and load recipes (its own storage.ts writing
// into an in-memory localStorage), plus what its lists show. The RemedyUI import must bring
// over every value unchanged and list the same recipes. Run: npx tsx remedyui/tools/gen-legacy.ts
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'legacy-localstorage.json')

const store = new Map<string, string>()
const ls: Storage = {
  get length() { return store.size },
  clear() { store.clear() },
  getItem(k: string) { return store.has(k) ? store.get(k)! : null },
  key(i: number) { return [...store.keys()][i] ?? null },
  removeItem(k: string) { store.delete(k) },
  setItem(k: string, v: string) { store.set(k, String(v)) },
}
const g = globalThis as unknown as { localStorage: Storage; window: { localStorage: Storage } }
g.localStorage = ls
g.window = { localStorage: ls }

const s = await import('../../src/lib/storage')

// A person's library: the everyday bar, an additive soap, a percent-mode legacy recipe,
// a KOH liquid soap with notes in several scripts, candles, an update and a delete.
s.saveSoapRecipe({
  name: 'Everyday Bar', oils: [{ oilId: 'olive', amount: 14.1096, pct: 40 }, { oilId: 'coconut', amount: 8.8185, pct: 25 }, { oilId: 'palm', amount: 8.8185, pct: 25 }, { oilId: 'castor', amount: 3.5274, pct: 10 }],
  lyeType: 'naoh', superfatPct: 5, waterMethod: 'percent_oils', waterAsPercentOfOils: 33, lyeConcentrationPct: 33, waterDiscountPct: 0, fragrancePct: 3, unit: 'oz', oilEntryMode: 'dual', totalOilsWeight: 35.274,
})
await new Promise((r) => setTimeout(r, 5))
s.saveSoapRecipe({
  name: 'Oatmeal & honey', oils: [{ oilId: 'olive', amount: 500, pct: 50 }, { oilId: 'coconut', amount: 300, pct: 30 }, { oilId: 'shea', amount: 200, pct: 20 }],
  lyeType: 'naoh', superfatPct: 6.5, waterMethod: 'lye_concentration', waterAsPercentOfOils: 33, lyeConcentrationPct: 31.5, waterDiscountPct: 0, fragrancePct: 2.5, unit: 'g', oilEntryMode: 'dual', totalOilsWeight: 1000,
  notes: 'Colloidal oats at trace. Cure 6 weeks.',
  additives: [{ additiveId: 'colloidal-oats', amount: 10, amountUnit: 'g' }, { additiveId: 'honey', amount: 1, amountUnit: 'tbsp' }, { additiveId: 'citric-acid', amount: 15 }],
})
await new Promise((r) => setTimeout(r, 5))
s.saveSoapRecipe({
  name: 'Flüssigseife – 液体石鹸 🧴', oils: [{ oilId: 'olive', amount: 1.5 }, { oilId: 'castor', amount: 0.5 }],
  lyeType: 'koh', superfatPct: 3, waterMethod: 'discount', waterAsPercentOfOils: 33, lyeConcentrationPct: 33, waterDiscountPct: 10, fragrancePct: 0, unit: 'lb', oilEntryMode: 'percent',
  notes: 'Paste — dilute 1:2. Notizen auf Deutsch, ملاحظات',
})
await new Promise((r) => setTimeout(r, 5))
const tmp = s.saveSoapRecipe({
  name: 'Delete me', oils: [{ oilId: 'olive', amount: 100 }], lyeType: 'naoh', superfatPct: 5, waterMethod: 'percent_oils', waterAsPercentOfOils: 33, lyeConcentrationPct: 33, waterDiscountPct: 0, fragrancePct: 0, unit: 'g',
})
s.deleteSoapRecipe(tmp.recipe.id)
await new Promise((r) => setTimeout(r, 5))
// Save by name again: updates the slot.
s.saveSoapRecipe({
  name: 'everyday bar', oils: [{ oilId: 'olive', amount: 14.1096, pct: 40 }, { oilId: 'coconut', amount: 8.8185, pct: 25 }, { oilId: 'palm', amount: 8.8185, pct: 25 }, { oilId: 'castor', amount: 3.5274, pct: 10 }],
  lyeType: 'naoh', superfatPct: 5.5, waterMethod: 'percent_oils', waterAsPercentOfOils: 33, lyeConcentrationPct: 33, waterDiscountPct: 0, fragrancePct: 3, unit: 'oz', oilEntryMode: 'dual', totalOilsWeight: 35.274,
})
s.saveCandleRecipe({ name: 'Lavender 8oz soy run', waxId: 'soy-111', vesselCount: 12, waxPerVessel: 198.45, useTotalWax: false, totalWax: 800, fragrancePct: 8, dyeBlocksPerLb: 1, unit: 'g', vesselDiameterIn: 3, vesselPresetId: '8oz', notes: 'Wick CD 10' })
await new Promise((r) => setTimeout(r, 5))
s.saveCandleRecipe({ name: 'Pillars', waxId: 'paraffin-pillar', vesselCount: 3, waxPerVessel: 0, useTotalWax: true, totalWax: 2.25, fragrancePct: 5, dyeBlocksPerLb: 2, unit: 'lb', vesselDiameterIn: 3, vesselPresetId: 'custom' })
// Loading a shared file merges it in.
const loaded = s.parseSharePayload(JSON.stringify(s.buildCandleSharePack({ id: 'x', savedAt: '2024-05-01T00:00:00.000Z', name: 'Shared beeswax', waxId: 'beeswax', vesselCount: 2, waxPerVessel: 100, useTotalWax: false, totalWax: 0, fragrancePct: 3, dyeBlocksPerLb: 0, unit: 'g', vesselDiameterIn: 2, notes: 'from a friend' })))
if (loaded.ok) s.mergeImportedRecipes(loaded)
s.setPrefs({ lastWikiId: 'oil-castor' })
ls.setItem('alien-craft-mode', 'candle')

const soapRaw = store.get('alien-craft-soap-recipes')!
const candleRaw = store.get('alien-craft-candle-recipes')!
// What earlier builds or hand edits can leave: an entry the app cannot read, kept as-is.
const withJunk = JSON.stringify([...JSON.parse(soapRaw), { name: 'Broken', oils: 'none', lyeType: 'naoh' }, 42])

const fixture = {
  localStorage: Object.fromEntries(store),
  listSoap: s.listSoapRecipes(),
  listCandle: s.listCandleRecipes(),
  prefs: s.getPrefs(),
  // A store with unreadable entries and a corrupt value, for the keep-everything rule.
  damaged: { 'alien-craft-soap-recipes': withJunk, 'alien-craft-candle-recipes': '{not json', 'alien-craft-prefs': '{"lastWikiId":"welcome","futurePref":true}' },
}
writeFileSync(out, JSON.stringify(fixture, null, 1) + '\n')
console.log(`wrote ${out}`)
