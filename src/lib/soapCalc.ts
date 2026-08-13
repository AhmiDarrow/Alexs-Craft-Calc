import {
  getOil,
  getOilFattyAcids,
  KOH_FACTOR,
  KOH_PURITY,
  type FattyAcid,
  type Oil,
} from '../data/oils'
import { getAdditive } from '../data/additives'

export type LyeType = 'naoh' | 'koh'
export type WaterMethod = 'percent_oils' | 'lye_concentration' | 'discount'
export type SoapUnit = 'g' | 'oz' | 'lb'
/** @deprecated Kept for saved-recipe compatibility; UI is always dual weight+% */
export type OilEntryMode = 'weight' | 'percent' | 'dual'

export interface OilLine {
  oilId: string
  /** Weight in the selected unit */
  amount: number
}

export interface AdditiveLine {
  additiveId: string
  /** Weight of the additive in the recipe unit */
  amount: number
}

export type AdditiveUsageStatus = 'ok' | 'low' | 'high'

export interface AdditiveResultLine {
  additiveId: string
  name: string
  /** Weight in the recipe unit */
  amount: number
  /** % of total oils (industry usage convention) */
  pctOfOils: number
  usageMin: number
  usageMax: number
  status: AdditiveUsageStatus
}

export interface SoapInput {
  oils: OilLine[]
  /** Add-ins: ground oats, clays, milks, etc. Optional — weights in the recipe unit. */
  additives?: AdditiveLine[]
  lyeType: LyeType
  /** Superfat % (typical 5–8) */
  superfatPct: number
  waterMethod: WaterMethod
  /** Water as % of oils (e.g. 33) when waterMethod = percent_oils */
  waterAsPercentOfOils: number
  /** Lye concentration % (e.g. 33 means 33% lye / 67% water) */
  lyeConcentrationPct: number
  /** Water discount % off full water (legacy style) */
  waterDiscountPct: number
  /** Fragrance oil % of total oils */
  fragrancePct: number
  unit: SoapUnit
}

export interface SoapResult {
  totalOils: number
  pureLye: number
  lyeWithSuperfat: number
  water: number
  fragrance: number
  totalBatch: number
  lyeSolution: number
  oilBreakdown: {
    oilId: string
    name: string
    amount: number
    pct: number
    sapUsed: number
  }[]
  weightedIodine: number | null
  weightedIns: number | null
  /** Fatty-acid quality profile with balanced-bar ranges. */
  quality: QualityMetric[]
  /** Additive lines with recommended-usage status. */
  additives: AdditiveResultLine[]
  /** Combined weight of all additives (in the recipe unit). */
  additiveTotal: number
  warnings: string[]
  /** True when results are intentionally blanked (e.g. % mode not at 100). */
  locked?: boolean
}

const G_PER_OZ = 28.349523125
const G_PER_LB = 453.59237

/** Citric-acid lye compensation — grams of lye per gram of acid (stoichiometric). */
export const CITRIC_NAOH_COMP = 0.624
/** 0.88 g pure KOH per g acid, ÷ 0.9 for 90% commercial KOH flakes. */
export const CITRIC_KOH_COMP = 0.88 / KOH_PURITY

/** Quality metrics (soapcalc.net-style) with balanced-bar target ranges. */
export type QualityKey =
  | 'hardness'
  | 'cleansing'
  | 'conditioning'
  | 'bubbly'
  | 'creamy'
  | 'longevity'
  | 'mildness'
  | 'iodine'
  | 'ins'

export type QualityStatus = 'low' | 'good' | 'high'

export interface QualityMetric {
  key: QualityKey
  label: string
  value: number | null
  /** Balanced-bar target range for this metric. */
  min: number
  max: number
  status: QualityStatus
  /** What raises this metric + what happens outside the range. */
  hint: string
}

const FA_KEYS: FattyAcid[] = [
  'caprylic',
  'capric',
  'lauric',
  'myristic',
  'palmitic',
  'stearic',
  'ricinoleic',
  'oleic',
  'linoleic',
  'linolenic',
  'palmitoleic',
]

/** Metric definitions + balanced-bar ranges (industry standard, soapcalc.net-compatible). */
export const QUALITY_DEFS: Omit<QualityMetric, 'value' | 'status'>[] = [
  {
    key: 'hardness',
    label: 'Hardness',
    min: 29,
    max: 54,
    hint: 'Lauric + myristic + palmitic + stearic — coconut, palm, tallow, lard, cocoa & stearic butters. Below ~29 the bar stays soft; above ~54 it can get brittle and hard to cut.',
  },
  {
    key: 'cleansing',
    label: 'Cleansing',
    min: 12,
    max: 22,
    hint: 'Lauric + myristic (coconut family). Above ~22 can strip skin; below ~12 may feel under-cleaning.',
  },
  {
    key: 'conditioning',
    label: 'Conditioning',
    min: 44,
    max: 69,
    hint: 'Oleic + linoleic + linolenic + ricinoleic + palmitoleic — olive, avocado, macadamia, castor, soft oils. Above ~69 the bar softens and cures slower.',
  },
  {
    key: 'bubbly',
    label: 'Bubbly lather',
    min: 14,
    max: 46,
    hint: 'Big fluffy bubbles come from lauric/myristic oils — coconut, palm kernel, babassu. Too high with low superfat = drying.',
  },
  {
    key: 'creamy',
    label: 'Creamy lather',
    min: 16,
    max: 48,
    hint: 'Palmitic + stearic + ricinoleic — palm, tallow, lard, butters, castor give dense, creamy suds.',
  },
  {
    key: 'longevity',
    label: 'Longevity',
    min: 18,
    max: 47,
    hint: 'Palmitic + stearic — palm, tallow, lard, cocoa/stearic butters. Low means the bar dissolves fast; high means a long-lasting, slow-wearing bar.',
  },
  {
    key: 'mildness',
    label: 'Mildness',
    min: 40,
    max: 70,
    hint: 'Oleic + linoleic + linolenic + ricinoleic + palmitoleic — olive, avocado, macadamia, soft oils, castor. Low can feel harsh; very high is gentle but softens the bar.',
  },
  {
    key: 'iodine',
    label: 'Iodine value',
    min: 41,
    max: 70,
    hint: 'Unsaturation → shelf life. Low = stable & hard; high = soft, faster rancidity (DOS). Keep high-iodine oils moderate and cure well.',
  },
  {
    key: 'ins',
    label: 'INS',
    min: 136,
    max: 165,
    hint: 'Iodine × SAP combo — hardness & stability proxy. Below ~136 soft; above ~165 can be drying.',
  },
]

function statusFor(value: number | null, min: number, max: number): QualityStatus {
  if (value == null || !Number.isFinite(value)) return 'low'
  if (value < min) return 'low'
  if (value > max) return 'high'
  return 'good'
}

/** Accumulate weighted fatty-acid profile across a set of oils. */
function accumulateFattyAcids(oils: OilLine[]): { fa: Record<FattyAcid, number>; total: number } {
  const fa: Record<FattyAcid, number> = {
    caprylic: 0,
    capric: 0,
    lauric: 0,
    myristic: 0,
    palmitic: 0,
    stearic: 0,
    ricinoleic: 0,
    oleic: 0,
    linoleic: 0,
    linolenic: 0,
    palmitoleic: 0,
  }
  let total = 0
  for (const line of oils) {
    if (!line.oilId || line.amount <= 0) continue
    const profile = getOilFattyAcids(line.oilId)
    total += line.amount
    for (const k of FA_KEYS) {
      const v = profile[k]
      if (v != null && Number.isFinite(v)) fa[k] += v * line.amount
    }
  }
  if (total > 0) {
    for (const k of FA_KEYS) fa[k] /= total
  }
  return { fa, total }
}

/** Weighted fatty-acid + iodine/INS quality profile for a recipe. */
export function computeQualityProfile(
  oils: OilLine[],
  weightedIodine: number | null,
  weightedIns: number | null,
): QualityMetric[] {
  const { fa } = accumulateFattyAcids(oils)

  const group = (...keys: FattyAcid[]) => keys.reduce((s, k) => s + fa[k], 0)
  const values: Record<QualityKey, number | null> = {
    hardness: group('caprylic', 'capric', 'lauric', 'myristic', 'palmitic', 'stearic'),
    cleansing: group('caprylic', 'capric', 'lauric', 'myristic'),
    conditioning: group('oleic', 'linoleic', 'linolenic', 'ricinoleic', 'palmitoleic'),
    bubbly: group('caprylic', 'capric', 'lauric', 'myristic'),
    creamy: group('palmitic', 'stearic', 'ricinoleic'),
    longevity: group('palmitic', 'stearic'),
    mildness: group('oleic', 'linoleic', 'linolenic', 'ricinoleic', 'palmitoleic'),
    iodine: weightedIodine,
    ins: weightedIns,
  }

  return QUALITY_DEFS.map((d) => {
    const value = values[d.key]
    const rounded = value != null ? round(value, 1) : null
    return {
      ...d,
      value: rounded,
      status: statusFor(rounded, d.min, d.max),
    }
  })
}

/**
 * Saturated : unsaturated ratio of the recipe fatty-acid profile.
 * Soapcalc.net suggests a typical balanced bar sits near 40:60.
 */
export function computeSatRatio(oils: OilLine[]): { sat: number; unsat: number } {
  const { fa } = accumulateFattyAcids(oils)
  const sat = fa.caprylic + fa.capric + fa.lauric + fa.myristic + fa.palmitic + fa.stearic
  const unsat =
    fa.ricinoleic + fa.oleic + fa.linoleic + fa.linolenic + fa.palmitoleic
  const sum = sat + unsat
  if (!(sum > 0)) return { sat: 0, unsat: 0 }
  return { sat: Math.round((sat / sum) * 100), unsat: Math.round((unsat / sum) * 100) }
}

/** How close oil % total must be to 100 before lye math unlocks. */
export const PCT_TOTAL_EPS = 0.05

function round(n: number, places = 2): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

function toGrams(value: number, unit: SoapUnit): number {
  if (unit === 'g') return value
  if (unit === 'oz') return value * G_PER_OZ
  return value * G_PER_LB
}

function fromGrams(grams: number, unit: SoapUnit): number {
  if (unit === 'g') return grams
  if (unit === 'oz') return grams / G_PER_OZ
  return grams / G_PER_LB
}

/** Convert between g, oz, and lb (weight). */
export function convertWeight(value: number, from: SoapUnit, to: SoapUnit): number {
  if (from === to) return value
  if (!Number.isFinite(value)) return value
  return fromGrams(toGrams(value, from), to)
}

export function sumOilPercents(pcts: number[]): number {
  return pcts.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0)
}

export function isPercentTotalLocked(sumPct: number, eps = PCT_TOTAL_EPS): boolean {
  if (!Number.isFinite(sumPct)) return false
  return Math.abs(sumPct - 100) <= eps
}

/** Derive oil weights from a batch total and per-oil percentages. */
export function oilsFromPercents(
  totalOils: number,
  lines: { oilId: string; pct: number }[],
): OilLine[] {
  if (!(totalOils > 0)) {
    return lines.map((l) => ({ oilId: l.oilId, amount: 0 }))
  }
  return lines.map((l) => ({
    oilId: l.oilId,
    amount: round(totalOils * ((Number.isFinite(l.pct) ? l.pct : 0) / 100), 4),
  }))
}

/**
 * % of one oil relative to the recipe ceiling (Total oils weight).
 * Does not look at other oils — the ceiling is the denominator.
 */
export function pctOfCeiling(amount: number, totalOils: number): number {
  if (!(totalOils > 0) || !Number.isFinite(amount) || amount <= 0) return 0
  return round((amount / totalOils) * 100, 4)
}

/** Weight of one oil from % of the recipe ceiling. */
export function amountFromCeilingPct(pct: number, totalOils: number): number {
  if (!(totalOils > 0) || !Number.isFinite(pct) || pct <= 0) return 0
  return round(totalOils * (pct / 100), 4)
}

/**
 * Derive display percentages from oil weights.
 * When `ceiling` is set (>0), each % is weight/ceiling (recipe total is fixed).
 * Otherwise falls back to share-of-sum (legacy).
 */
export function percentsFromOils(
  lines: OilLine[],
  ceiling?: number,
): { oilId: string; pct: number }[] {
  const safeAmt = (a: number) => (Number.isFinite(a) && a > 0 ? a : 0)
  if (ceiling != null && ceiling > 0) {
    return lines.map((l) => ({
      oilId: l.oilId,
      pct: pctOfCeiling(safeAmt(l.amount), ceiling),
    }))
  }
  const total = lines.reduce((s, l) => s + safeAmt(l.amount), 0)
  if (!(total > 0)) {
    return lines.map((l) => ({ oilId: l.oilId, pct: 0 }))
  }
  return lines.map((l) => ({
    oilId: l.oilId,
    pct: round((safeAmt(l.amount) / total) * 100, 4),
  }))
}

/** True when the sum of oil weights matches the Total oils ceiling. */
export function weightsMatchCeiling(
  amounts: number[],
  ceiling: number,
  eps = PCT_TOTAL_EPS,
): boolean {
  if (!(ceiling > 0) || !Number.isFinite(ceiling)) return false
  // Any non-finite amount means the batch state is corrupt — never "match".
  if (amounts.some((a) => !Number.isFinite(a))) return false
  const sum = amounts.reduce((s, a) => s + (a > 0 ? a : 0), 0)
  // Match within eps% of ceiling (same tolerance family as 100% lock).
  return Math.abs(sum - ceiling) <= Math.max(ceiling * (eps / 100), 1e-6)
}

export function emptyLockedResult(warnings: string[]): SoapResult {
  return {
    totalOils: 0,
    pureLye: 0,
    lyeWithSuperfat: 0,
    water: 0,
    fragrance: 0,
    totalBatch: 0,
    lyeSolution: 0,
    oilBreakdown: [],
    weightedIodine: null,
    weightedIns: null,
    quality: [],
    additives: [],
    additiveTotal: 0,
    warnings,
    locked: true,
  }
}

export function calculateSoap(input: SoapInput): SoapResult {
  const warnings: string[] = []
  const breakdown: SoapResult['oilBreakdown'] = []
  let totalOils = 0
  let pureLye = 0
  let iodineSum = 0
  let insSum = 0
  let iodineWeight = 0
  let insWeight = 0

  for (const line of input.oils) {
    // Reject non-finite / non-positive amounts (NaN, Infinity, negatives, zero).
    // `amount <= 0` alone is false for NaN, which previously poisoned totals.
    if (!line.oilId || !Number.isFinite(line.amount) || line.amount <= 0) continue
    const oil: Oil | undefined = getOil(line.oilId)
    if (!oil) {
      warnings.push(`Unknown oil id: ${line.oilId}`)
      continue
    }
    const amount = line.amount
    totalOils += amount
    // NaOH: 100% purity (industrial grade). KOH: NaOH SAP × 1.4027 (MW ratio),
    // then ÷ 0.9 — commercial KOH for liquid soap is ~90% pure (soapcalc default).
    const sap =
      input.lyeType === 'naoh' ? oil.sapNaoh : (oil.sapNaoh * KOH_FACTOR) / KOH_PURITY
    pureLye += amount * sap
    breakdown.push({
      oilId: oil.id,
      name: oil.name,
      amount,
      pct: 0,
      sapUsed: sap,
    })
    if (oil.iodine != null) {
      iodineSum += oil.iodine * amount
      iodineWeight += amount
    }
    if (oil.ins != null) {
      insSum += oil.ins * amount
      insWeight += amount
    }
  }

  if (totalOils <= 0) {
    return {
      totalOils: 0,
      pureLye: 0,
      lyeWithSuperfat: 0,
      water: 0,
      fragrance: 0,
      totalBatch: 0,
      lyeSolution: 0,
      oilBreakdown: [],
      weightedIodine: null,
      weightedIns: null,
      quality: [],
      additives: [],
      additiveTotal: 0,
      warnings: ['Add at least one oil with a weight greater than zero.'],
    }
  }

  for (const b of breakdown) {
    b.pct = round((b.amount / totalOils) * 100, 1)
    b.amount = round(b.amount, 2)
  }

  // Additives — weights are in the recipe unit; usage is checked as % of total oils.
  const additives: AdditiveResultLine[] = (input.additives ?? [])
    .filter((a) => a.additiveId && Number.isFinite(a.amount) && a.amount > 0)
    .map((a) => {
      const add = getAdditive(a.additiveId)
      const pctOfOils = totalOils > 0 ? (a.amount / totalOils) * 100 : 0
      const min = add?.usagePct.min ?? 0
      const max = add?.usagePct.max ?? 100
      let status: AdditiveUsageStatus = 'ok'
      if (add && pctOfOils < min - 1e-9) status = 'low'
      else if (add && pctOfOils > max + 1e-9) status = 'high'
      if (add && pctOfOils < min) {
        warnings.push(
          `${add.name}: below recommended usage (${round(pctOfOils, 1)}% vs ${min}–${max}% of oils).`,
        )
      } else if (add && pctOfOils > max) {
        warnings.push(
          `${add.name}: above recommended usage (${round(pctOfOils, 1)}% vs ${min}–${max}% of oils).`,
        )
      }
      return {
        additiveId: a.additiveId,
        name: add?.name ?? a.additiveId,
        amount: round(a.amount, 2),
        pctOfOils: round(pctOfOils, 2),
        usageMin: min,
        usageMax: max,
        status,
      }
    })

  // Citric acid neutralizes lye — compensate automatically (stoichiometric factors).
  const citricAmount = additives
    .filter((a) => a.additiveId === 'citric-acid')
    .reduce((s, a) => s + a.amount, 0)
  const citricLyeComp =
    citricAmount * (input.lyeType === 'naoh' ? CITRIC_NAOH_COMP : CITRIC_KOH_COMP)
  if (citricLyeComp > 0) {
    warnings.push(
      `Citric acid: added ${round(citricLyeComp, 2)} ${input.unit} of ${input.lyeType === 'naoh' ? 'NaOH' : 'KOH'} to compensate for the acid.`,
    )
  }

  // Clamp helpers: Math.min/max with NaN return NaN and poison the batch.
  const clamp = (n: number, lo: number, hi: number, fallback: number) =>
    Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback

  const sf = clamp(input.superfatPct, 0, 20, 5) / 100
  // Superfat discounts the oil-saponification lye only; the citric-acid
  // compensation is added full-strength on top (the acid is not an oil).
  const lyeWithSuperfat = pureLye * (1 - sf) + citricLyeComp

  let water = 0
  if (input.waterMethod === 'percent_oils') {
    const pct = clamp(input.waterAsPercentOfOils, 20, 45, 33) / 100
    water = totalOils * pct
  } else if (input.waterMethod === 'lye_concentration') {
    const conc = clamp(input.lyeConcentrationPct, 25, 50, 33) / 100
    // concentration = lye / (lye + water) → water = lye * (1-c)/c
    water = lyeWithSuperfat * ((1 - conc) / conc)
  } else {
    // discount from classic ~38% of oils water
    const full = totalOils * 0.38
    const disc = clamp(input.waterDiscountPct, 0, 40, 0) / 100
    water = full * (1 - disc)
  }

  const fragrance = totalOils * (clamp(input.fragrancePct, 0, 10, 0) / 100)
  const lyeSolution = lyeWithSuperfat + water
  const additiveTotal = additives.reduce((s, a) => s + a.amount, 0)
  const totalBatch = totalOils + lyeWithSuperfat + water + fragrance + additiveTotal

  // Soft checks
  const coconutish = breakdown
    .filter((b) => ['coconut', 'palm-kernel', 'babassu', 'coconut-fractionated'].includes(b.oilId))
    .reduce((s, b) => s + b.pct, 0)
  if (coconutish > 40) {
    warnings.push(
      'High lauric oils (>40%) can be drying — consider higher superfat or more conditioning oils.',
    )
  }
  if (sf < 0.03) {
    warnings.push('Superfat under 3% leaves little buffer for measurement error.')
  }
  if (sf > 0.1) {
    warnings.push('Superfat over 10% may soften the bar and shorten shelf life.')
  }

  const weightedIodine = iodineWeight > 0 ? round(iodineSum / iodineWeight, 1) : null
  const weightedIns = insWeight > 0 ? round(insSum / insWeight, 1) : null
  const quality = computeQualityProfile(input.oils, weightedIodine, weightedIns)

  if (weightedIodine != null && weightedIodine > 70) {
    warnings.push('High iodine value — bar may go rancid faster; cure well and store cool.')
  }

  return {
    totalOils: round(totalOils, 2),
    pureLye: round(pureLye + citricLyeComp, 2),
    lyeWithSuperfat: round(lyeWithSuperfat, 2),
    water: round(water, 2),
    fragrance: round(fragrance, 2),
    totalBatch: round(totalBatch, 2),
    lyeSolution: round(lyeSolution, 2),
    oilBreakdown: breakdown,
    weightedIodine,
    weightedIns,
    quality,
    additives,
    additiveTotal,
    warnings,
  }
}

export function defaultSoapInput(): SoapInput {
  // Default unit is ounces (common kitchen / US craft scale).
  // Same mass as the classic 1000 g everyday bar (≈ 35.274 oz).
  return {
    oils: [
      { oilId: 'olive', amount: round(fromGrams(400, 'oz'), 4) },
      { oilId: 'coconut', amount: round(fromGrams(250, 'oz'), 4) },
      { oilId: 'palm', amount: round(fromGrams(250, 'oz'), 4) },
      { oilId: 'castor', amount: round(fromGrams(100, 'oz'), 4) },
    ],
    lyeType: 'naoh',
    superfatPct: 5,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    lyeConcentrationPct: 33,
    waterDiscountPct: 0,
    fragrancePct: 3,
    unit: 'oz',
  }
}
