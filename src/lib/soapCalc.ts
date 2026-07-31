import { KOH_FACTOR, getOil, type Oil } from '../data/oils'

export type LyeType = 'naoh' | 'koh'
export type WaterMethod = 'percent_oils' | 'lye_concentration' | 'discount'
export type SoapUnit = 'g' | 'oz' | 'lb'
export type OilEntryMode = 'weight' | 'percent'

export interface OilLine {
  oilId: string
  /** Weight in the selected unit */
  amount: number
}

export interface SoapInput {
  oils: OilLine[]
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
  warnings: string[]
  /** True when results are intentionally blanked (e.g. % mode not at 100). */
  locked?: boolean
}

const G_PER_OZ = 28.349523125
const G_PER_LB = 453.59237

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

/** Derive percentages from oil weights (0 if total is 0). */
export function percentsFromOils(lines: OilLine[]): { oilId: string; pct: number }[] {
  const total = lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0)
  if (!(total > 0)) {
    return lines.map((l) => ({ oilId: l.oilId, pct: 0 }))
  }
  return lines.map((l) => ({
    oilId: l.oilId,
    pct: round(((l.amount > 0 ? l.amount : 0) / total) * 100, 4),
  }))
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
    if (!line.oilId || line.amount <= 0) continue
    const oil: Oil | undefined = getOil(line.oilId)
    if (!oil) {
      warnings.push(`Unknown oil id: ${line.oilId}`)
      continue
    }
    totalOils += line.amount
    const sap = input.lyeType === 'naoh' ? oil.sapNaoh : oil.sapNaoh * KOH_FACTOR
    pureLye += line.amount * sap
    breakdown.push({
      oilId: oil.id,
      name: oil.name,
      amount: line.amount,
      pct: 0,
      sapUsed: sap,
    })
    if (oil.iodine != null) {
      iodineSum += oil.iodine * line.amount
      iodineWeight += line.amount
    }
    if (oil.ins != null) {
      insSum += oil.ins * line.amount
      insWeight += line.amount
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
      warnings: ['Add at least one oil with a weight greater than zero.'],
    }
  }

  for (const b of breakdown) {
    b.pct = round((b.amount / totalOils) * 100, 1)
    b.amount = round(b.amount, 2)
  }

  const sf = Math.max(0, Math.min(20, input.superfatPct)) / 100
  const lyeWithSuperfat = pureLye * (1 - sf)

  let water = 0
  if (input.waterMethod === 'percent_oils') {
    const pct = Math.max(20, Math.min(45, input.waterAsPercentOfOils)) / 100
    water = totalOils * pct
  } else if (input.waterMethod === 'lye_concentration') {
    const conc = Math.max(25, Math.min(50, input.lyeConcentrationPct)) / 100
    // concentration = lye / (lye + water) → water = lye * (1-c)/c
    water = lyeWithSuperfat * ((1 - conc) / conc)
  } else {
    // discount from classic ~38% of oils water
    const full = totalOils * 0.38
    const disc = Math.max(0, Math.min(40, input.waterDiscountPct)) / 100
    water = full * (1 - disc)
  }

  const fragrance = totalOils * (Math.max(0, Math.min(10, input.fragrancePct)) / 100)
  const lyeSolution = lyeWithSuperfat + water
  const totalBatch = totalOils + lyeWithSuperfat + water + fragrance

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

  if (weightedIodine != null && weightedIodine > 70) {
    warnings.push('High iodine value — bar may go rancid faster; cure well and store cool.')
  }

  return {
    totalOils: round(totalOils, 2),
    pureLye: round(pureLye, 2),
    lyeWithSuperfat: round(lyeWithSuperfat, 2),
    water: round(water, 2),
    fragrance: round(fragrance, 2),
    totalBatch: round(totalBatch, 2),
    lyeSolution: round(lyeSolution, 2),
    oilBreakdown: breakdown,
    weightedIodine,
    weightedIns,
    warnings,
  }
}

export function defaultSoapInput(): SoapInput {
  return {
    oils: [
      { oilId: 'olive', amount: 400 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'palm', amount: 250 },
      { oilId: 'castor', amount: 100 },
    ],
    lyeType: 'naoh',
    superfatPct: 5,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    lyeConcentrationPct: 33,
    waterDiscountPct: 0,
    fragrancePct: 3,
    unit: 'g',
  }
}
