import { getWax, type Wax } from '../data/waxes'

export type WeightUnit = 'g' | 'oz' | 'lb'

export interface CandleInput {
  waxId: string
  /** Number of vessels */
  vesselCount: number
  /** Wax weight per vessel (in unit) OR total wax if useTotal */
  waxPerVessel: number
  useTotalWax: boolean
  totalWax: number
  /** Fragrance load % of wax weight */
  fragrancePct: number
  /** Optional dye chips / blocks count guidance */
  dyeBlocksPerLb: number
  unit: WeightUnit
  /** Wick suggestion mode */
  vesselDiameterIn: number
}

export interface CandleResult {
  wax: Wax | null
  totalWax: number
  fragrance: number
  dyeBlocks: number
  totalBatch: number
  perVessel: {
    wax: number
    fragrance: number
    total: number
  }
  wickHint: string
  pourHint: string
  warnings: string[]
}

function round(n: number, places = 2): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function toOz(value: number, unit: WeightUnit): number {
  if (unit === 'oz') return value
  if (unit === 'g') return value / 28.349523125
  return value * 16 // lb
}

export function fromOz(valueOz: number, unit: WeightUnit): number {
  if (unit === 'oz') return valueOz
  if (unit === 'g') return valueOz * 28.349523125
  return valueOz / 16
}

export function calculateCandle(input: CandleInput): CandleResult {
  const warnings: string[] = []
  const wax = getWax(input.waxId) ?? null
  const count = Math.max(1, Math.floor(input.vesselCount) || 1)

  let totalWax = 0
  if (input.useTotalWax) {
    totalWax = Math.max(0, input.totalWax)
  } else {
    totalWax = Math.max(0, input.waxPerVessel) * count
  }

  if (totalWax <= 0) {
    return {
      wax,
      totalWax: 0,
      fragrance: 0,
      dyeBlocks: 0,
      totalBatch: 0,
      perVessel: { wax: 0, fragrance: 0, total: 0 },
      wickHint: 'Enter wax weight to get wick guidance.',
      pourHint: '',
      warnings: ['Enter a wax weight greater than zero.'],
    }
  }

  let foPct = input.fragrancePct
  if (wax) {
    if (foPct < wax.fragranceMin) {
      warnings.push(
        `Fragrance ${foPct}% is below typical min (${wax.fragranceMin}%) for ${wax.name} — scent may be weak.`,
      )
    }
    if (foPct > wax.fragranceMax) {
      warnings.push(
        `Fragrance ${foPct}% exceeds typical max (${wax.fragranceMax}%) for ${wax.name} — risk of sweating / poor burn.`,
      )
    }
  }
  foPct = Math.max(0, Math.min(15, foPct))

  const fragrance = totalWax * (foPct / 100)
  const totalBatch = totalWax + fragrance

  // Dye: user-defined blocks per lb of wax
  const totalOz = toOz(totalWax, input.unit)
  const lbs = totalOz / 16
  const dyeBlocks = round(lbs * Math.max(0, input.dyeBlocksPerLb), 2)

  const perWax = totalWax / count
  const perFo = fragrance / count

  const wickHint = suggestWick(input.vesselDiameterIn, wax)
  let pourHint = ''
  if (wax?.pourTempF) {
    pourHint = `Typical pour ~${wax.pourTempF}°F` + (wax.meltPointF ? ` · melt point ~${wax.meltPointF}°F` : '')
  }
  if (wax?.notes) {
    pourHint = pourHint ? `${pourHint} · ${wax.notes}` : wax.notes
  }

  return {
    wax,
    totalWax: round(totalWax, 2),
    fragrance: round(fragrance, 2),
    dyeBlocks,
    totalBatch: round(totalBatch, 2),
    perVessel: {
      wax: round(perWax, 2),
      fragrance: round(perFo, 2),
      total: round(perWax + perFo, 2),
    },
    wickHint,
    pourHint,
    warnings,
  }
}

/** Rough single-wick guidance by jar diameter (inches). Not a substitute for testing. */
export function suggestWick(diameterIn: number, wax: Wax | null): string {
  if (!diameterIn || diameterIn <= 0) {
    return 'Set vessel diameter for a rough single-wick starting point (always test burn).'
  }
  const d = diameterIn
  // Generic ECO / CD-ish starting ranges — always test
  let series = 'ECO / CD / LX family'
  let size = ''
  if (d < 1.5) size = 'ECO 0.5–1 or CD 2–3'
  else if (d < 2.0) size = 'ECO 1–2 or CD 3–4'
  else if (d < 2.5) size = 'ECO 2–4 or CD 5–6'
  else if (d < 3.0) size = 'ECO 4–6 or CD 7–8'
  else if (d < 3.5) size = 'ECO 6–8 or CD 10–12 (or dual wick)'
  else if (d < 4.0) size = 'Dual wick ECO 4–6 or CD 6–8 each'
  else size = 'Multi-wick recommended — test carefully'

  const waxNote = wax ? ` for ${wax.name}` : ''
  return `Ø ${d}"${waxNote}: try ${size} (${series}). Always perform a full test burn.`
}

export function unitLabel(unit: WeightUnit): string {
  return unit
}

export function defaultCandleInput(): CandleInput {
  return {
    waxId: 'soy-111',
    vesselCount: 4,
    waxPerVessel: 200,
    useTotalWax: false,
    totalWax: 800,
    fragrancePct: 8,
    dyeBlocksPerLb: 1,
    unit: 'g',
    vesselDiameterIn: 3,
  }
}
