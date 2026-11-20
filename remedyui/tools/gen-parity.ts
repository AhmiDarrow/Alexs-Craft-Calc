// Generates tests/fixtures/parity.json.gz: the shipped app's own TypeScript run on thousands of
// inputs, so `cargo test --test parity` can prove the Rust port gives the same bits and the
// same displayed text. Run: `npx tsx remedyui/tools/gen-parity.ts` (deterministic seed).
//
// The calculators' math and storage come straight from src/lib. The form handlers live
// inside the React components, so `SoapModel` / `CandleModel` below are those handlers
// copied verbatim from SoapCalculator.tsx / CandleCalculator.tsx with React state swapped for
// fields (setX(v) → this.x = v); keep them in step with the components.
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  additiveAmountInRecipeUnit,
  amountFromCeilingPct,
  calculateSoap,
  computeQualityProfile,
  computeSatRatio,
  convertAdditiveAmountUnit,
  convertWeight,
  defaultSoapInput,
  emptyLockedResult,
  isPercentTotalLocked,
  oilsFromPercents,
  pctOfCeiling,
  percentsFromOils,
  sumOilPercents,
  weightsMatchCeiling,
  type AdditiveAmountUnit,
  type LyeType,
  type OilLine,
  type SoapInput,
  type SoapUnit,
  type WaterMethod,
} from '../../src/lib/soapCalc'
import { calculateCandle, defaultCandleInput, fromOz, suggestWick, type CandleInput, type WeightUnit } from '../../src/lib/candleCalc'
import { OILS, getOil } from '../../src/data/oils'
import { ADDITIVES, additiveUsageStatus, getAdditive, isAdditiveVolumeUnit } from '../../src/data/additives'
import { WAXES, VESSEL_PRESETS, getWax } from '../../src/data/waxes'
import { buildFullWiki, searchWiki } from '../../src/data/wiki'
import {
  formatImportSummary,
  parseSharePayload,
  type SavedCandleRecipe,
  type SavedSoapRecipe,
} from '../../src/lib/storage'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'parity.json.gz')

// mulberry32
let seed = 0x5eedc0de
function rnd(): number {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
function num(lo: number, hi: number, places: number): number {
  const v = lo + rnd() * (hi - lo)
  return Number(v.toFixed(places))
}
const numStr = (lo: number, hi: number) => String(num(lo, hi, int(0, 4)))

/* ─── Numbers ─────────────────────────────────────────────────────────── */
const numbers: number[] = [
  0, 1, -1, 0.1 + 0.2, 1e21, 1.5e21, 1e-7, 1.25e-7, 0.000001, 123456789012345680000, 35.274, 2.5, -2.5, 1.005,
  0.49999999999999994, 4.35, 1.4027 * 0.135, 999999999999999900000, 5e-324, 1.7976931348623157e308,
]
for (let i = 0; i < 3000; i++) {
  const e = int(-12, 24)
  numbers.push(Number((rnd() * 10 ** e * (rnd() < 0.2 ? -1 : 1)).toPrecision(int(1, 17))))
  numbers.push(rnd() * 10 ** int(-3, 6))
}
const numberCases = numbers.map((n) => ({
  n,
  s: String(n),
  r0: Math.round(n),
  r2: Math.round(n * 100) / 100,
  f4: Math.abs(n) < 1e21 ? n.toFixed(4) : null,
  f2: Math.abs(n) < 1e21 ? n.toFixed(2) : null,
}))
const parseCases = ['12.5abc', '  .5', '5.', '1e3x', '1e', '', '-', '-Infinity', '+3.25', '0x10', '1,5', '٣', '  12  ', '00012.5000', '-0', '.e1', '7e-3', '1.2.3']
  .map((s) => ({ s, pf: Number.isNaN(parseFloat(s)) ? 'NaN' : String(parseFloat(s)), pi: Number.isNaN(parseInt(s, 10)) ? 'NaN' : String(parseInt(s, 10)), num: Number.isNaN(Number(s)) ? 'NaN' : String(Number(s)) }))

/* ─── Soap math ───────────────────────────────────────────────────────── */
const oilIds = OILS.map((o) => o.id)
const addIds = ADDITIVES.map((a) => a.id)
const units: SoapUnit[] = ['g', 'oz', 'lb']
const addUnits: AdditiveAmountUnit[] = ['g', 'oz', 'lb', 'tsp', 'tbsp']
function randomSoapInput(): SoapInput {
  const oils: OilLine[] = []
  for (let i = int(0, 7); i > 0; i--) {
    const r = rnd()
    oils.push({
      oilId: r < 0.03 ? 'no-such-oil' : r < 0.05 ? '' : pick(oilIds),
      amount: r > 0.97 ? -num(0, 50, 2) : r > 0.95 ? 0 : num(0, 1200, int(0, 6)),
    })
  }
  const additives = []
  for (let i = int(0, 4); i > 0; i--) {
    additives.push({ additiveId: rnd() < 0.05 ? 'mystery' : rnd() < 0.15 ? 'citric-acid' : pick(addIds), amount: num(0, 80, int(0, 5)) })
  }
  return {
    oils,
    additives,
    lyeType: rnd() < 0.7 ? 'naoh' : 'koh',
    superfatPct: num(-5, 25, int(0, 2)),
    waterMethod: pick(['percent_oils', 'lye_concentration', 'discount'] as WaterMethod[]),
    waterAsPercentOfOils: num(10, 50, int(0, 2)),
    lyeConcentrationPct: num(20, 55, int(0, 2)),
    waterDiscountPct: num(-5, 45, int(0, 2)),
    fragrancePct: num(-1, 12, int(0, 2)),
    unit: pick(units),
  }
}
const soapCases = [{ input: defaultSoapInput(), result: calculateSoap(defaultSoapInput()) }]
for (let i = 0; i < 2500; i++) {
  const input = randomSoapInput()
  soapCases.push({ input, result: calculateSoap(input) })
}
const satCases = soapCases.slice(0, 800).map((c) => ({ oils: c.input.oils, sat: computeSatRatio(c.input.oils) }))
const qualityCases = soapCases.slice(0, 300).map((c) => ({ oils: c.input.oils, iodine: 60.2, ins: 140, q: computeQualityProfile(c.input.oils, 60.2, 140) }))

const helperCases = [] as unknown[]
for (let i = 0; i < 1500; i++) {
  const v = num(-10, 5000, int(0, 6))
  const from = pick(units)
  const to = pick(units)
  const af = pick(addUnits)
  const at = pick(addUnits)
  const id = rnd() < 0.1 ? 'mystery' : pick(addIds)
  const total = rnd() < 0.1 ? 0 : num(0, 2000, int(0, 4))
  const pct = num(-5, 110, int(0, 4))
  const lines = Array.from({ length: int(0, 6) }, () => ({ oilId: pick(oilIds), amount: rnd() < 0.1 ? -1 : num(0, 900, int(0, 5)) }))
  helperCases.push({
    v, from, to, af, at, id, total, pct, lines,
    convertWeight: convertWeight(v, from, to),
    addInRecipe: additiveAmountInRecipeUnit(v, af, to, id),
    convertAdd: convertAdditiveAmountUnit(v, af, at, id),
    pctOfCeiling: pctOfCeiling(v, total),
    amountFromCeilingPct: amountFromCeilingPct(pct, total),
    oilsFromPercents: oilsFromPercents(total, lines.map((l) => ({ oilId: l.oilId, pct: l.amount / 10 }))),
    percentsCeiling: percentsFromOils(lines, total),
    percentsShare: percentsFromOils(lines),
    weightsMatch: weightsMatchCeiling(lines.map((l) => l.amount), total),
    sumPct: sumOilPercents(lines.map((l) => l.amount / 10)),
    locked: isPercentTotalLocked(100 + (rnd() - 0.5) * 0.2),
    usage: additiveUsageStatus(v / 100, { min: 1, max: 3 }),
  })
}

/* ─── Candle math ─────────────────────────────────────────────────────── */
const waxIds = WAXES.map((w) => w.id)
const candleCases = [{ input: defaultCandleInput(), result: calculateCandle(defaultCandleInput()) }]
for (let i = 0; i < 2500; i++) {
  const input: CandleInput = {
    waxId: rnd() < 0.05 ? 'mystery-wax' : pick(waxIds),
    vesselCount: rnd() < 0.05 ? 0 : num(-2, 40, int(0, 2)),
    waxPerVessel: num(-10, 900, int(0, 4)),
    useTotalWax: rnd() < 0.4,
    totalWax: rnd() < 0.05 ? 0 : num(-10, 9000, int(0, 4)),
    fragrancePct: num(-2, 20, int(0, 2)),
    dyeBlocksPerLb: num(-1, 6, int(0, 3)),
    unit: pick(units),
    vesselDiameterIn: rnd() < 0.05 ? 0 : num(0.5, 5, int(0, 3)),
  }
  candleCases.push({ input, result: calculateCandle(input) })
}
const wickCases = Array.from({ length: 200 }, () => {
  const d = num(-1, 6, int(0, 3))
  const w = rnd() < 0.2 ? null : pick(WAXES)
  return { d, waxId: w?.id ?? null, wick: suggestWick(d, w) }
})

/* ─── Wiki ────────────────────────────────────────────────────────────── */
const wiki = buildFullWiki(OILS, WAXES)
const queries = ['', 'olive', 'coconut lauric', 'WICK', '  trace  ', 'soy wax', 'zzz', 'lye safety', 'fo', 'ins', 'é', '**', 'kaolin clay', 'castor', 'f1 help']
const searchCases = queries.map((q) => ({ q, ids: searchWiki(wiki, q).map((a) => a.id) }))

type Span = { text: string; bold: boolean }
type Block = { kind: 'bullets' | 'numbered'; items: string[] } | { kind: 'paragraph'; lines: Span[][] }
function formatInline(line: string): Span[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  const spans: Span[] = []
  for (const p of parts) {
    if (p.startsWith('**') && p.endsWith('**') && p.length >= 4 && /^\*\*[^*]+\*\*$/.test(p)) {
      spans.push({ text: p.slice(2, -2), bold: true })
    } else if (p !== '') {
      const last = spans[spans.length - 1]
      if (last && !last.bold) last.text += p
      else spans.push({ text: p, bold: false })
    }
  }
  if (spans.length === 0) spans.push({ text: '', bold: false })
  return spans
}
// renderBody from Wiki.tsx, producing data instead of JSX.
function renderBody(text: string): Block[] {
  const blocks = text.split(/\n\n+/)
  return blocks.map((block) => {
    const lines = block.split('\n')
    const isList = lines.every((l) => /^[•\-\*]/.test(l.trim()) || l.trim() === '')
    if (isList) return { kind: 'bullets', items: lines.filter((l) => l.trim()).map((l) => l.replace(/^[•\-\*]\s*/, '')) }
    const isNum = lines.every((l) => /^\d+\./.test(l.trim()) || l.trim() === '')
    if (isNum) return { kind: 'numbered', items: lines.filter((l) => l.trim()).map((l) => l.replace(/^\d+\.\s*/, '')) }
    return { kind: 'paragraph', lines: lines.map(formatInline) }
  })
}
const bodies = wiki.flatMap((a) => a.sections.map((s) => s.body))
bodies.push('a **b** c', '**x**', '***y***', 'p ** q', '1. one\n2. two', '- a\n\n\n- b', '  • indented', 'plain\n\nnext')
const blockCases = bodies.map((b) => ({ body: b, blocks: renderBody(b) }))

/* ─── Storage ─────────────────────────────────────────────────────────── */
function randomSavedSoap(): Record<string, unknown> {
  const r: Record<string, unknown> = {
    id: pick(['soap-abc-12345', '  spaced-id  ', '', 'x'.repeat(100)]),
    name: pick(['Lavender bar', '  padded  ', '', 'Ünïcödé 🧼 soap', 'n'.repeat(130)]),
    savedAt: pick(['2025-03-04T10:20:30.000Z', '2024-12-31T23:59:59Z', '2025-01-02', '2025-01-02T03:04', '2025-01-02T03:04:05+02:00', 'not a date', '2025-13-01']),
    oils: Array.from({ length: int(0, 4) }, () => {
      const o: Record<string, unknown> = { oilId: pick(oilIds), amount: num(0, 900, 3) }
      if (rnd() < 0.5) o.pct = num(0, 100, 2)
      return o
    }),
    lyeType: pick(['naoh', 'koh']),
    superfatPct: num(0, 20, 1),
    waterMethod: pick(['percent_oils', 'lye_concentration', 'discount']),
    waterAsPercentOfOils: pick([33, 0, '38', null, undefined, 'abc', 25.5]),
    lyeConcentrationPct: pick([33, 0, undefined, 30]),
    waterDiscountPct: pick([0, 10, undefined, '5']),
    fragrancePct: pick([3, 0, undefined, '4.5', true]),
    unit: pick(['g', 'oz', 'lb']),
  }
  if (rnd() < 0.5) r.oilEntryMode = pick(['weight', 'percent', 'dual', 'bogus'])
  if (rnd() < 0.5) r.totalOilsWeight = pick([1000, 0, -5, 35.274])
  if (rnd() < 0.5) r.notes = pick(['  cure 6 weeks  ', '', '   ', 'n'.repeat(4100)])
  if (rnd() < 0.5)
    r.additives = Array.from({ length: int(0, 3) }, () => {
      const a: Record<string, unknown> = { additiveId: pick(addIds), amount: pick([10, 0, 2.5, -1]) }
      if (rnd() < 0.7) a.amountUnit = pick(addUnits)
      return a
    })
  if (rnd() < 0.2) r.extraField = 'kept?'
  return r
}
function randomSavedCandle(): Record<string, unknown> {
  const r: Record<string, unknown> = {
    id: pick(['candle-abc-12345', '', ' c ']),
    name: pick(['Soy run', '', '  x  ']),
    savedAt: pick(['2025-03-04T10:20:30.000Z', 'nope']),
    waxId: pick(waxIds),
    vesselCount: pick([4, 0, 2.7, -3]),
    waxPerVessel: pick([200, 0, 99.5]),
    useTotalWax: pick([true, false]),
    totalWax: pick([800, 0, 1234.5]),
    fragrancePct: pick([8, 0, 10.5]),
    unit: pick(['g', 'oz', 'lb']),
  }
  if (rnd() < 0.7) r.dyeBlocksPerLb = pick([1, 0, '2', undefined])
  if (rnd() < 0.7) r.vesselDiameterIn = pick([3, 0, 2.75])
  if (rnd() < 0.7) r.vesselPresetId = pick(['8oz', '', 'p'.repeat(50)])
  if (rnd() < 0.5) r.notes = pick(['  notes ', ''])
  return r
}
const payloads: string[] = [
  '', '   ', 'not json', '42', '"str"', 'null', '[]', '{}', '﻿{}',
  JSON.stringify({ format: 'alex-craft-calc-recipe', version: 1, kind: 'soap', soap: [] }),
  JSON.stringify({ format: 'alien-craft-calc-recipe', version: 1, kind: 'soap', soap: [randomSavedSoap()] }),
  JSON.stringify([{ bogus: true }]),
]
for (let i = 0; i < 400; i++) {
  const soap = Array.from({ length: int(0, 3) }, randomSavedSoap)
  const candle = Array.from({ length: int(0, 3) }, randomSavedCandle)
  if (rnd() < 0.15) (soap[0] ?? candle[0] ?? ({} as Record<string, unknown>)).lyeType = 'bogus'
  const r = rnd()
  if (r < 0.5) payloads.push(JSON.stringify({ format: 'alex-craft-calc-recipe', version: 1, app: "Alex's Craft Calc", exportedAt: '2025-01-01T00:00:00.000Z', kind: pick(['soap', 'candle', 'library']), soap, candle }))
  else if (r < 0.7) payloads.push(JSON.stringify(soap[0] ?? randomSavedSoap()))
  else if (r < 0.85) payloads.push(JSON.stringify(candle[0] ?? randomSavedCandle()))
  else payloads.push(JSON.stringify([...soap, ...candle]))
}
const strip = <T extends { id: string; savedAt: string }>(r: T, keepSavedAt: boolean) => {
  const { id: _id, savedAt, ...rest } = r
  return keepSavedAt ? { ...rest, savedAt } : rest
}
const parseCases2 = payloads.map((p) => {
  const r = parseSharePayload(p)
  if (!r.ok) return { payload: p, ok: false, error: r.error }
  return {
    payload: p,
    ok: true,
    kind: r.kind,
    message: r.message,
    // Imported recipes get fresh ids; savedAt is kept only when it parsed.
    soap: (r.soap ?? []).map((x: SavedSoapRecipe) => strip(x, !Number.isNaN(Date.parse(x.savedAt)) && x.savedAt.length > 0)),
    candle: (r.candle ?? []).map((x: SavedCandleRecipe) => strip(x, true)),
  }
})
const summaryCases = Array.from({ length: 40 }, () => {
  const m = { soapSaved: int(0, 2), candleSaved: int(0, 2), soapUpdated: int(0, 2), candleUpdated: int(0, 2) }
  return { m, s: formatImportSummary(m) }
})

/* ─── Soap form: the component's handlers, copied verbatim ────────────── */
function fmtNum(n: number, places = 2): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 10 ** places) / 10 ** places
  return String(r)
}
function qualityBarPos(q: { value: number | null; min: number; max: number }): number {
  const span = q.max - q.min
  if (q.value == null || !(span > 0) || !Number.isFinite(q.value)) return 0
  const t = (q.value - q.min) / span
  return Math.max(0, Math.min(100, 25 + t * 50))
}
type OilRow = { oilId: string; amount: string; pct: string }
type AdditiveRow = { additiveId: string; amount: string; amountUnit: AdditiveAmountUnit }
const PRESETS: { name: string; oils: OilLine[] }[] = [
  { name: 'Castile-ish', oils: [{ oilId: 'olive', amount: 1000 }] },
  { name: 'Everyday Bar', oils: [{ oilId: 'olive', amount: 400 }, { oilId: 'coconut', amount: 250 }, { oilId: 'palm', amount: 250 }, { oilId: 'castor', amount: 100 }] },
  { name: 'Creamy Shea', oils: [{ oilId: 'olive', amount: 350 }, { oilId: 'coconut', amount: 250 }, { oilId: 'shea', amount: 200 }, { oilId: 'rice-bran', amount: 150 }, { oilId: 'castor', amount: 50 }] },
  { name: 'Palm-free', oils: [{ oilId: 'olive', amount: 400 }, { oilId: 'coconut', amount: 250 }, { oilId: 'tallow', amount: 250 }, { oilId: 'castor', amount: 50 }, { oilId: 'shea', amount: 50 }] },
  { name: 'Luxury Butter', oils: [{ oilId: 'olive', amount: 300 }, { oilId: 'coconut', amount: 200 }, { oilId: 'shea', amount: 150 }, { oilId: 'cocoa', amount: 150 }, { oilId: 'avocado', amount: 150 }, { oilId: 'castor', amount: 50 }] },
]
function rowsFromWeightOils(oils: OilLine[], ceiling: number): OilRow[] {
  const pcts = percentsFromOils(oils, ceiling > 0 ? ceiling : undefined)
  return oils.map((o, i) => ({ oilId: o.oilId, amount: String(o.amount), pct: fmtNum(pcts[i]?.pct ?? 0, 2) }))
}
function rowsFromPercentOils(lines: { oilId: string; pct: number }[], ceiling: number): OilRow[] {
  const oils = oilsFromPercents(ceiling, lines)
  return oils.map((o, i) => ({ oilId: o.oilId, amount: fmtNum(o.amount, 4), pct: fmtNum(lines[i]?.pct ?? 0, 2) }))
}
class SoapModel {
  defaults = defaultSoapInput()
  defaultCeiling = this.defaults.oils.reduce((s, o) => s + o.amount, 0)
  rows: OilRow[] = rowsFromWeightOils(this.defaults.oils, this.defaultCeiling)
  lyeType: LyeType = 'naoh'
  superfatPct = '5'
  waterMethod: WaterMethod = 'percent_oils'
  waterAsPercentOfOils = '33'
  lyeConcentrationPct = '33'
  waterDiscountPct = '0'
  fragrancePct = '3'
  unit: SoapUnit = 'oz'
  totalOilsWeight = fmtNum(this.defaultCeiling, 4)
  recipeName = ''
  recipeNotes = ''
  additiveRows: AdditiveRow[] = []
  toast = ''
  get u() { return this.unit }
  get parsedTotalOils() { return parseFloat(this.totalOilsWeight) || 0 }
  get weightSum() { return this.rows.reduce((s, r) => { if (!r.oilId) return s; const a = parseFloat(r.amount); return s + (Number.isFinite(a) && a > 0 ? a : 0) }, 0) }
  get pctSum() { return sumOilPercents(this.rows.filter((r) => r.oilId).map((r) => parseFloat(r.pct) || 0)) }
  get pctOk() { return isPercentTotalLocked(this.pctSum) }
  get pctDelta() { return Math.round((this.pctSum - 100) * 100) / 100 }
  get weightsOk() { return this.parsedTotalOils > 0 && weightsMatchCeiling(this.rows.filter((r) => r.oilId).map((r) => parseFloat(r.amount) || 0), this.parsedTotalOils) }
  get weightDelta() { return Math.round((this.weightSum - this.parsedTotalOils) * 10000) / 10000 }
  get resolvedOils(): OilLine[] { return this.rows.filter((r) => r.oilId).map((r) => ({ oilId: r.oilId, amount: parseFloat(r.amount) || 0 })) }
  get input(): SoapInput {
    return {
      oils: this.resolvedOils, lyeType: this.lyeType, superfatPct: parseFloat(this.superfatPct) || 0, waterMethod: this.waterMethod,
      waterAsPercentOfOils: parseFloat(this.waterAsPercentOfOils) || 0, lyeConcentrationPct: parseFloat(this.lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(this.waterDiscountPct) || 0, fragrancePct: parseFloat(this.fragrancePct) || 0, unit: this.unit,
      additives: this.additiveRows.filter((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0).map((r) => ({ additiveId: r.additiveId, amount: additiveAmountInRecipeUnit(parseFloat(r.amount) || 0, r.amountUnit, this.unit, r.additiveId) })),
    }
  }
  get lockWarnings() {
    const w: string[] = []
    const { parsedTotalOils, pctOk, pctSum, weightsOk, weightSum, u } = this
    if (!(parsedTotalOils > 0)) w.push('Enter a Total oils weight — that is the recipe ceiling.')
    if (!pctOk) {
      w.push(pctSum === 0 ? 'Enter oil weights or percentages that total 100% of Total oils.' : 'Oil percentages must total 100% of Total oils before results unlock (currently ' + fmtNum(pctSum, 2) + '%).')
    } else if (!weightsOk) {
      w.push('Oil weights must add up to Total oils (' + fmtNum(parsedTotalOils, 4) + ' ' + u + ') — currently ' + fmtNum(weightSum, 4) + ' ' + u + '.')
    }
    return w
  }
  get result() { return this.lockWarnings.length > 0 ? emptyLockedResult(this.lockWarnings) : calculateSoap(this.input) }
  updateRowWeight(i: number, amountStr: string) {
    const r = this.rows[i]; if (!r) return
    const amount = parseFloat(amountStr)
    const pct = this.parsedTotalOils > 0 && Number.isFinite(amount) ? pctOfCeiling(amount > 0 ? amount : 0, this.parsedTotalOils) : 0
    this.rows[i] = { ...r, amount: amountStr, pct: fmtNum(pct, 2) }
  }
  updateRowPct(i: number, pctStr: string) {
    const r = this.rows[i]; if (!r) return
    const pct = parseFloat(pctStr)
    const amount = this.parsedTotalOils > 0 && Number.isFinite(pct) ? amountFromCeilingPct(pct > 0 ? pct : 0, this.parsedTotalOils) : 0
    this.rows[i] = { ...r, pct: pctStr, amount: fmtNum(amount, 4) }
  }
  updateRowOil(i: number, oilId: string) { if (this.rows[i]) this.rows[i] = { ...this.rows[i], oilId } }
  addRow() { this.rows.push({ oilId: '', amount: '0', pct: '0' }) }
  addAdditiveRow(additiveId = '') { this.additiveRows.push({ additiveId, amount: '', amountUnit: this.unit }) }
  updateAdditiveAmount(i: number, amountStr: string) { if (this.additiveRows[i]) this.additiveRows[i] = { ...this.additiveRows[i], amount: amountStr } }
  updateAdditiveAmountUnit(i: number, nextUnit: AdditiveAmountUnit) {
    const r = this.additiveRows[i]; if (!r || r.amountUnit === nextUnit) return
    const n = parseFloat(r.amount)
    if (!Number.isFinite(n) || r.amount.trim() === '') { this.additiveRows[i] = { ...r, amountUnit: nextUnit }; return }
    const converted = convertAdditiveAmountUnit(n, r.amountUnit, nextUnit, r.additiveId)
    this.additiveRows[i] = { ...r, amountUnit: nextUnit, amount: fmtNum(converted, nextUnit === 'tsp' || nextUnit === 'tbsp' ? 3 : 4) }
  }
  removeAdditiveRow(i: number) { this.additiveRows.splice(i, 1) }
  removeRow(i: number) { this.rows.splice(i, 1) }
  applyPreset(oils: OilLine[], name?: string) {
    const converted = oils.map((o) => ({ oilId: o.oilId, amount: convertWeight(o.amount, 'g', this.unit) }))
    const total = converted.reduce((s, o) => s + o.amount, 0)
    this.totalOilsWeight = fmtNum(total, 4)
    this.rows = rowsFromWeightOils(converted, total)
    this.additiveRows = []
    if (name) this.recipeName = name
    this.toast = name ? name + ' loaded' : 'Preset loaded'
  }
  startCustomRecipe() {
    const total = this.parsedTotalOils > 0 ? this.parsedTotalOils : this.unit === 'lb' ? 2 : this.unit === 'oz' ? 32 : 1000
    this.rows = []; this.additiveRows = []; this.totalOilsWeight = fmtNum(total, 4); this.recipeName = 'Custom'; this.recipeNotes = ''
    this.toast = 'Custom — empty recipe. Add oils; Total oils is the ceiling'
  }
  onTotalOilsChange(value: string) {
    const prevCeiling = this.parsedTotalOils
    const nextCeiling = parseFloat(value) || 0
    this.totalOilsWeight = value
    if (!(nextCeiling > 0)) return
    this.rows = this.rows.map((r) => {
      const pct = parseFloat(r.pct)
      let usePct = Number.isFinite(pct) ? pct : 0
      if (!(usePct > 0) && prevCeiling > 0) { const amt = parseFloat(r.amount) || 0; usePct = pctOfCeiling(amt, prevCeiling) }
      return { ...r, pct: fmtNum(usePct, 2), amount: fmtNum(amountFromCeilingPct(usePct > 0 ? usePct : 0, nextCeiling), 4) }
    })
  }
  applyPercentsToCeiling() {
    const target = parseFloat(this.totalOilsWeight)
    if (!target || target <= 0) { this.toast = 'Enter a Total oils weight first'; return }
    if (!this.pctOk) { this.toast = 'Oil % must total 100% before applying'; return }
    this.rows = this.rows.map((r) => { const pct = parseFloat(r.pct) || 0; return { ...r, amount: fmtNum(amountFromCeilingPct(pct, target), 4), pct: fmtNum(pct, 2) } })
    this.toast = 'Weights set from % × Total oils'
  }
  scaleWeightsToCeiling() {
    const target = parseFloat(this.totalOilsWeight)
    if (!target || target <= 0) { this.toast = 'Enter a Total oils weight first'; return }
    const current = this.rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (!(current > 0)) { this.toast = 'Add oil weights before scaling'; return }
    const factor = target / current
    this.rows = this.rows.map((r) => { const amount = (parseFloat(r.amount) || 0) * factor; return { ...r, amount: fmtNum(amount, 4), pct: fmtNum(pctOfCeiling(amount, target), 2) } })
    this.toast = 'Scaled oils to Total oils (' + fmtNum(target, 4) + ' ' + this.u + ')'
  }
  resetDefaults() {
    const d = defaultSoapInput()
    const total = d.oils.reduce((s, o) => s + o.amount, 0)
    this.lyeType = d.lyeType; this.superfatPct = String(d.superfatPct); this.waterMethod = d.waterMethod
    this.waterAsPercentOfOils = String(d.waterAsPercentOfOils); this.lyeConcentrationPct = String(d.lyeConcentrationPct)
    this.waterDiscountPct = String(d.waterDiscountPct); this.fragrancePct = String(d.fragrancePct); this.unit = d.unit
    this.totalOilsWeight = fmtNum(total, 4); this.rows = rowsFromWeightOils(d.oils, total); this.recipeName = ''; this.recipeNotes = ''; this.additiveRows = []
    this.toast = 'Soap calculator reset'
  }
  onUnitChange(next: SoapUnit) {
    if (next === this.unit) return
    const unit = this.unit
    const st = parseFloat(this.totalOilsWeight)
    const nextCeiling = Number.isFinite(st) && st > 0 ? convertWeight(st, unit, next) : 0
    this.rows = this.rows.map((r) => {
      const n = parseFloat(r.amount)
      if (!Number.isFinite(n)) return r
      const amount = convertWeight(n, unit, next)
      return { ...r, amount: fmtNum(amount, 4), pct: fmtNum(pctOfCeiling(amount, nextCeiling > 0 ? nextCeiling : 0), 2) }
    })
    this.additiveRows = this.additiveRows.map((r) => {
      if (isAdditiveVolumeUnit(r.amountUnit)) return r
      const n = parseFloat(r.amount)
      if (!Number.isFinite(n) || r.amount.trim() === '') return { ...r, amountUnit: next }
      return { ...r, amountUnit: next, amount: fmtNum(convertWeight(n, r.amountUnit as SoapUnit, next), 4) }
    })
    if (nextCeiling > 0) this.totalOilsWeight = fmtNum(nextCeiling, 4)
    this.unit = next
  }
  loadRecipe(r: SavedSoapRecipe) {
    const nextUnit: SoapUnit = r.unit === 'g' || r.unit === 'lb' || r.unit === 'oz' ? r.unit : 'oz'
    const totalFromRecipe = r.totalOilsWeight != null && r.totalOilsWeight > 0 ? r.totalOilsWeight : r.oils.reduce((s, o) => s + (o.amount > 0 ? o.amount : 0), 0)
    const preferPct = r.oilEntryMode === 'percent'
    let nextRows: OilRow[]
    if (preferPct && totalFromRecipe > 0) {
      const lines = r.oils.map((o) => ({ oilId: o.oilId, pct: o.pct != null && o.pct > 0 ? o.pct : pctOfCeiling(o.amount, totalFromRecipe) }))
      nextRows = rowsFromPercentOils(lines, totalFromRecipe)
    } else {
      nextRows = r.oils.map((o) => {
        const amount = o.amount > 0 ? o.amount : 0
        const pct = o.pct != null && o.pct > 0 ? o.pct : totalFromRecipe > 0 ? pctOfCeiling(amount, totalFromRecipe) : 0
        return { oilId: o.oilId, amount: String(amount), pct: fmtNum(pct, 2) }
      })
      if (totalFromRecipe > 0 && nextRows.every((row) => !(parseFloat(row.amount) > 0)) && nextRows.some((row) => parseFloat(row.pct) > 0)) {
        nextRows = rowsFromPercentOils(nextRows.map((row) => ({ oilId: row.oilId, pct: parseFloat(row.pct) || 0 })), totalFromRecipe)
      }
    }
    this.totalOilsWeight = totalFromRecipe > 0 ? fmtNum(totalFromRecipe, 4) : fmtNum(this.unit === 'lb' ? 2 : this.unit === 'oz' ? 32 : 1000, 4)
    this.rows = nextRows; this.lyeType = r.lyeType; this.superfatPct = String(r.superfatPct); this.waterMethod = r.waterMethod
    this.waterAsPercentOfOils = String(r.waterAsPercentOfOils); this.lyeConcentrationPct = String(r.lyeConcentrationPct)
    this.waterDiscountPct = String(r.waterDiscountPct); this.fragrancePct = String(r.fragrancePct); this.unit = nextUnit
    this.recipeName = r.name; this.recipeNotes = r.notes || ''
    this.additiveRows = (r.additives ?? []).map((a) => ({ additiveId: a.additiveId, amount: String(a.amount), amountUnit: (['g', 'oz', 'lb', 'tsp', 'tbsp'].includes(a.amountUnit as string) ? a.amountUnit : nextUnit) as AdditiveAmountUnit }))
    this.toast = `Loaded “${r.name}”`
  }
  formatRecipeText() {
    const { u, unit, lyeType, superfatPct, fragrancePct, waterMethod, rows, parsedTotalOils, weightSum, pctSum, recipeNotes, additiveRows, recipeName } = this
    const result = this.result
    const lyeName = lyeType === 'naoh' ? 'NaOH' : 'KOH'
    const oilLines = rows.filter((r) => r.oilId).map((r) => { const oil = getOil(r.oilId); const amt = parseFloat(r.amount) || 0; const pct = parseFloat(r.pct) || 0; return '  • ' + (oil?.name || r.oilId) + ': ' + fmtNum(amt, 4) + ' ' + u + ' (' + fmtNum(pct, 2) + '%)' })
    const lines = [
      "Alex's Craft Calc — Soap Recipe" + (recipeName ? ': ' + recipeName : ''),
      'Unit: ' + u + ' · Lye: ' + lyeName + ' · Superfat: ' + superfatPct + '% · FO: ' + fragrancePct + '%',
      'Water method: ' + waterMethod,
      'Total oils ceiling: ' + (parsedTotalOils || result.totalOils) + ' ' + u,
      'Oil weight sum: ' + fmtNum(weightSum, 4) + ' ' + u + ' · Oil % sum: ' + fmtNum(pctSum, 2) + '%',
      '', 'Oils:', ...oilLines,
      ...(additiveRows.some((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0)
        ? ['', 'Additives:', ...additiveRows.filter((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0).map((r) => {
            const add = getAdditive(r.additiveId); const amt = parseFloat(r.amount) || 0; const entry = r.amountUnit
            const asRecipe = additiveAmountInRecipeUnit(amt, r.amountUnit, unit, r.additiveId)
            const spoonNote = isAdditiveVolumeUnit(r.amountUnit) && asRecipe > 0 ? ` (≈ ${fmtNum(asRecipe, 3)} ${u})` : ''
            return '  • ' + (add?.name || r.additiveId) + ': ' + fmtNum(amt, 4) + ' ' + entry + spoonNote
          })]
        : []),
      '',
      result.locked ? 'Results locked — oil weights/% must match Total oils ceiling (100%).' : [
        'Total oils: ' + result.totalOils + ' ' + u, lyeName + ' (with SF): ' + result.lyeWithSuperfat + ' ' + u, 'Pure lye 0% SF: ' + result.pureLye + ' ' + u,
        'Water: ' + result.water + ' ' + u, 'Lye solution: ' + result.lyeSolution + ' ' + u, 'Fragrance: ' + result.fragrance + ' ' + u, 'Batch total: ' + result.totalBatch + ' ' + u,
        result.weightedIodine != null ? 'Weighted iodine: ' + result.weightedIodine : '', result.weightedIns != null ? 'Weighted INS: ' + result.weightedIns : '',
      ].filter(Boolean).join('\n'),
      recipeNotes.trim() ? '\nNotes:\n' + recipeNotes.trim() : '', '', 'Always add lye to water. Wear PPE. Verify SAP with supplier COA.',
    ]
    return lines.filter((x) => x !== '').join('\n')
  }
  get recipeBalanced() { return this.pctOk && this.weightsOk && this.parsedTotalOils > 0 }
  get statusHint() {
    const { recipeBalanced, parsedTotalOils, pctOk, pctDelta, weightDelta, u } = this
    return recipeBalanced ? 'Unlocked — matches Total oils ceiling' : !parsedTotalOils ? 'Set Total oils ceiling' : !pctOk
      ? pctDelta > 0 ? fmtNum(pctDelta, 2) + '% over 100% — locked' : fmtNum(Math.abs(pctDelta), 2) + '% short of 100% — locked'
      : weightDelta > 0 ? fmtNum(weightDelta, 4) + ' ' + u + ' over ceiling — locked' : fmtNum(Math.abs(weightDelta), 4) + ' ' + u + ' under ceiling — locked'
  }
  additiveView(row: AdditiveRow) {
    const add = getAdditive(row.additiveId)
    const amt = parseFloat(row.amount) || 0
    const amtInRecipe = row.additiveId && amt > 0 ? additiveAmountInRecipeUnit(amt, row.amountUnit, this.unit, row.additiveId) : 0
    const pctOfOils = this.parsedTotalOils > 0 && amtInRecipe > 0 ? (amtInRecipe / this.parsedTotalOils) * 100 : 0
    const usage = add ? additiveUsageStatus(pctOfOils, add.usagePct) : 'n/a'
    const usageLabel = usage === 'good' ? `OK · ${add!.usagePct.min}–${add!.usagePct.max}%` : usage === 'low' ? `Low · ${add!.usagePct.min}–${add!.usagePct.max}%` : usage === 'high' ? `High · max ${add!.usagePct.max}%` : '—'
    const meta = [add?.ppo ? `${add.ppo} PPO` : null, add?.phase || null, amtInRecipe > 0 && isAdditiveVolumeUnit(row.amountUnit) ? `≈ ${fmtNum(amtInRecipe, 3)} ${this.u}` : null, pctOfOils > 0 ? `${fmtNum(pctOfOils, 2)}% of oils` : null].filter(Boolean)
    return { status: usage === 'good' ? 'ok' : usage, label: usageLabel, meta }
  }
  snapshot() {
    return structuredClone(this.snapshotLive())
  }
  snapshotLive() {
    const result = this.result
    return {
      rows: this.rows, additiveRows: this.additiveRows, totalOilsWeight: this.totalOilsWeight, unit: this.unit, recipeName: this.recipeName,
      superfatPct: this.superfatPct, fragrancePct: this.fragrancePct, lyeType: this.lyeType, waterMethod: this.waterMethod,
      lockWarnings: this.lockWarnings, statusHint: this.statusHint, result,
      quality: result.locked ? [] : computeQualityProfile(this.resolvedOils, result.weightedIodine, result.weightedIns).map((q) => ({ ...q, bar: qualityBarPos(q) })),
      sat: result.locked ? null : computeSatRatio(this.resolvedOils),
      text: this.formatRecipeText(), toast: this.toast, additiveViews: this.additiveRows.map((r) => this.additiveView(r)),
      overMax: this.rows.map((row) => { const oil = getOil(row.oilId); const p = parseFloat(row.pct) || 0; return oil?.maxPct != null && p > 0 && p > oil.maxPct + 0.05 }),
    }
  }
}

function randomSoapAction(m: SoapModel): unknown[] {
  const r = rnd()
  const n = m.rows.length
  const an = m.additiveRows.length
  if (r < 0.2 && n) return ['weight', int(0, n - 1), numStr(0, 600)]
  if (r < 0.35 && n) return ['pct', int(0, n - 1), numStr(0, 60)]
  if (r < 0.4 && n) return ['oil', int(0, n - 1), pick(oilIds)]
  if (r < 0.45) return ['addRow']
  if (r < 0.48 && n) return ['removeRow', int(0, n - 1)]
  if (r < 0.53) return ['addAdditive', pick(addIds)]
  if (r < 0.58 && an) return ['additiveAmount', int(0, an - 1), numStr(0, 40)]
  if (r < 0.62 && an) return ['additiveUnit', int(0, an - 1), pick(addUnits)]
  if (r < 0.64 && an) return ['removeAdditive', int(0, an - 1)]
  if (r < 0.69) return ['total', rnd() < 0.05 ? '0' : numStr(1, 3000)]
  if (r < 0.73) return ['applyPercents']
  if (r < 0.77) return ['scale']
  if (r < 0.81) return ['unit', pick(units)]
  if (r < 0.84) return ['preset', int(0, PRESETS.length - 1)]
  if (r < 0.85) return ['custom']
  if (r < 0.86) return ['reset']
  if (r < 0.88) return ['lye', pick(['naoh', 'koh'])]
  if (r < 0.9) return ['superfat', numStr(0, 20)]
  if (r < 0.92) return ['fragrance', numStr(0, 10)]
  if (r < 0.94) return ['water', pick(['percent_oils', 'lye_concentration', 'discount'])]
  if (r < 0.96) return ['waterPct', numStr(20, 45)]
  if (r < 0.97) return ['lyeConc', numStr(25, 50)]
  if (r < 0.98) return ['discount', numStr(0, 40)]
  return ['notes', pick(['', '  cure 6 weeks ', 'lavender + mica'])]
}
function applySoap(m: SoapModel, a: unknown[]) {
  m.toast = ''
  const [k, x, y] = a as [string, number & string, string]
  switch (k) {
    case 'weight': m.updateRowWeight(x, y); break
    case 'pct': m.updateRowPct(x, y); break
    case 'oil': m.updateRowOil(x, y); break
    case 'addRow': m.addRow(); break
    case 'removeRow': m.removeRow(x); break
    case 'addAdditive': m.addAdditiveRow(x as unknown as string); break
    case 'additiveAmount': m.updateAdditiveAmount(x, y); break
    case 'additiveUnit': m.updateAdditiveAmountUnit(x, y as AdditiveAmountUnit); break
    case 'removeAdditive': m.removeAdditiveRow(x); break
    case 'total': m.onTotalOilsChange(x as unknown as string); break
    case 'applyPercents': m.applyPercentsToCeiling(); break
    case 'scale': m.scaleWeightsToCeiling(); break
    case 'unit': m.onUnitChange(x as unknown as SoapUnit); break
    case 'preset': m.applyPreset(PRESETS[x].oils, PRESETS[x].name); break
    case 'custom': m.startCustomRecipe(); break
    case 'reset': m.resetDefaults(); break
    case 'lye': m.lyeType = x as unknown as LyeType; break
    case 'superfat': m.superfatPct = x as unknown as string; break
    case 'fragrance': m.fragrancePct = x as unknown as string; break
    case 'water': m.waterMethod = x as unknown as WaterMethod; break
    case 'waterPct': m.waterAsPercentOfOils = x as unknown as string; break
    case 'lyeConc': m.lyeConcentrationPct = x as unknown as string; break
    case 'discount': m.waterDiscountPct = x as unknown as string; break
    case 'notes': m.recipeNotes = x as unknown as string; break
  }
}
const soapScripts = Array.from({ length: 100 }, () => {
  const m = new SoapModel()
  const steps = [{ action: ['start'], state: m.snapshot() }]
  for (let i = int(5, 30); i > 0; i--) {
    const action = randomSoapAction(m)
    applySoap(m, action)
    steps.push({ action, state: m.snapshot() })
  }
  return steps
})
// Loading saved recipes into the form (shapes the saved list can hold).
const loadCases = Array.from({ length: 200 }, () => {
  const raw = randomSavedSoap()
  raw.savedAt = '2025-03-04T10:20:30.000Z'
  raw.id = 'soap-fixed-00001'
  const parsed = parseSharePayload(JSON.stringify({ format: 'alex-craft-calc-recipe', version: 1, kind: 'soap', soap: [raw] }))
  if (!parsed.ok || !parsed.soap) return null
  const recipe = { ...parsed.soap[0], id: 'soap-fixed-00001' }
  const m = new SoapModel()
  if (rnd() < 0.5) m.onUnitChange(pick(units))
  const before = m.unit
  m.loadRecipe(recipe)
  return { recipe, unitBefore: before, state: m.snapshot() }
}).filter(Boolean)

/* ─── Candle form ─────────────────────────────────────────────────────── */
class CandleModel {
  waxId = 'soy-111'; vesselCount = '4'; waxPerVessel = '200'; useTotalWax = false; totalWax = '800'; fragrancePct = '8'
  dyeBlocksPerLb = '1'; unit: WeightUnit = 'g'; vesselDiameterIn = '3'; vesselPresetId = 'custom'; recipeName = ''; recipeNotes = ''
  get input(): CandleInput {
    return { waxId: this.waxId, vesselCount: parseInt(this.vesselCount, 10) || 1, waxPerVessel: parseFloat(this.waxPerVessel) || 0, useTotalWax: this.useTotalWax,
      totalWax: parseFloat(this.totalWax) || 0, fragrancePct: parseFloat(this.fragrancePct) || 0, dyeBlocksPerLb: parseFloat(this.dyeBlocksPerLb) || 0, unit: this.unit, vesselDiameterIn: parseFloat(this.vesselDiameterIn) || 0 }
  }
  get result() { return calculateCandle(this.input) }
  onWaxChange(id: string) { this.waxId = id; const w = getWax(id); if (w) this.fragrancePct = String(w.fragranceTypical) }
  applyVesselPreset(id: string) {
    this.vesselPresetId = id
    const p = VESSEL_PRESETS.find((v) => v.id === id)
    if (!p || p.fillOz <= 0) return
    const waxInUnit = fromOz(p.fillOz, this.unit)
    this.useTotalWax = false
    this.waxPerVessel = String(Math.round(waxInUnit * 100) / 100)
    if (id.startsWith('pillar-3')) this.vesselDiameterIn = '3'
    else if (id === 'tealight') this.vesselDiameterIn = '1.5'
    else if (id === 'votive') this.vesselDiameterIn = '1.75'
    else if (id === '4oz') this.vesselDiameterIn = '2.5'
    else if (id === '6oz') this.vesselDiameterIn = '2.75'
    else if (id === '8oz' || id === '9oz') this.vesselDiameterIn = '3'
    else if (id === '10oz' || id === '12oz') this.vesselDiameterIn = '3.25'
    else if (id === '16oz') this.vesselDiameterIn = '3.5'
  }
  onUnitChange(next: WeightUnit) {
    if (next === this.unit) return
    const unit = this.unit
    const convert = (val: string) => {
      const n = parseFloat(val)
      if (!Number.isFinite(n)) return val
      const oz = unit === 'oz' ? n : unit === 'g' ? n / 28.349523125 : n * 16
      const out = next === 'oz' ? oz : next === 'g' ? oz * 28.349523125 : oz / 16
      return String(Math.round(out * 100) / 100)
    }
    this.waxPerVessel = convert(this.waxPerVessel); this.totalWax = convert(this.totalWax); this.unit = next
  }
  formatRecipeText() {
    const result = this.result
    const selectedWax = getWax(this.waxId)
    const lines = [
      `Alex's Craft Calc — Candle`, this.recipeName ? `Name: ${this.recipeName}` : null, `Wax: ${selectedWax?.name || this.waxId}`, `Vessels: ${this.vesselCount}`,
      this.useTotalWax ? `Total wax: ${result.totalWax} ${this.unit}` : `Wax / vessel: ${result.perVessel.wax} ${this.unit}`,
      `FO load: ${this.fragrancePct}% → ${result.fragrance} ${this.unit} total`, `FO / vessel: ${result.perVessel.fragrance} ${this.unit}`,
      `Batch total: ${result.totalBatch} ${this.unit}`, `Dye blocks est.: ${result.dyeBlocks}`, `Diameter: ${this.vesselDiameterIn}"`, `Wick: ${result.wickHint}`,
      result.pourHint ? `Pour: ${result.pourHint}` : null, result.warnings.length ? `Warnings: ${result.warnings.join(' | ')}` : null,
      this.recipeNotes.trim() ? `Notes:\n${this.recipeNotes.trim()}` : null,
    ].filter(Boolean)
    return lines.join('\n')
  }
  get foInRange() { const w = getWax(this.waxId); return !!(w && parseFloat(this.fragrancePct) >= w.fragranceMin && parseFloat(this.fragrancePct) <= w.fragranceMax) }
  snapshot() {
    const { waxId, vesselCount, waxPerVessel, useTotalWax, totalWax, fragrancePct, dyeBlocksPerLb, unit, vesselDiameterIn, vesselPresetId } = this
    return structuredClone({ waxId, vesselCount, waxPerVessel, useTotalWax, totalWax, fragrancePct, dyeBlocksPerLb, unit, vesselDiameterIn, vesselPresetId, result: this.result, text: this.formatRecipeText(), foInRange: this.foInRange })
  }
}
const candleScripts = Array.from({ length: 150 }, () => {
  const m = new CandleModel()
  const steps = [{ action: ['start'], state: m.snapshot() }]
  for (let i = int(5, 30); i > 0; i--) {
    const r = rnd()
    let action: unknown[]
    if (r < 0.15) action = ['wax', pick(waxIds)]
    else if (r < 0.3) action = ['preset', pick(VESSEL_PRESETS).id]
    else if (r < 0.42) action = ['unit', pick(units)]
    else if (r < 0.52) action = ['count', String(int(0, 30))]
    else if (r < 0.62) action = ['perVessel', numStr(0, 800)]
    else if (r < 0.68) action = ['useTotal', rnd() < 0.5]
    else if (r < 0.75) action = ['total', numStr(0, 8000)]
    else if (r < 0.83) action = ['fo', numStr(0, 18)]
    else if (r < 0.88) action = ['dye', numStr(0, 5)]
    else if (r < 0.94) action = ['diameter', numStr(0.5, 5)]
    else if (r < 0.97) action = ['foPreset', pick(['min', 'typical', 'max'])]
    else action = ['name', pick(['', 'Soy run'])]
    const [k, v] = action as [string, string & boolean]
    switch (k) {
      case 'wax': m.onWaxChange(v); break
      case 'preset': m.applyVesselPreset(v); break
      case 'unit': m.onUnitChange(v as WeightUnit); break
      case 'count': m.vesselCount = v; break
      case 'perVessel': m.waxPerVessel = v; m.vesselPresetId = 'custom'; break
      case 'useTotal': m.useTotalWax = v; break
      case 'total': m.totalWax = v; m.vesselPresetId = 'custom'; break
      case 'fo': m.fragrancePct = v; break
      case 'dye': m.dyeBlocksPerLb = v; break
      case 'diameter': m.vesselDiameterIn = v; break
      case 'foPreset': { const w = getWax(m.waxId); if (w) m.fragrancePct = String(v === 'min' ? w.fragranceMin : v === 'max' ? w.fragranceMax : w.fragranceTypical); break }
      case 'name': m.recipeName = v; break
    }
    steps.push({ action, state: m.snapshot() })
  }
  return steps
})

const fixture = {
  numberCases, parseCases, soapCases, satCases, qualityCases, helperCases, candleCases, wickCases,
  wiki, searchCases, blockCases, parseCases2, summaryCases, soapScripts, loadCases, candleScripts,
}
// Quality hints are static text (checked once through data/quality.json); leave them out of
// every result so the fixture stays small.
writeFileSync(out, gzipSync(JSON.stringify(fixture, (k, v) => (k === 'hint' ? undefined : v)), { level: 9 }))
console.log(`wrote ${out}: ${soapCases.length} soap, ${candleCases.length} candle, ${soapScripts.length} soap scripts, ${candleScripts.length} candle scripts`)
