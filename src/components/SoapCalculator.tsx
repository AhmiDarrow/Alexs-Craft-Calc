import { useCallback, useMemo, useRef, useState } from 'react'
import { OILS, getOil } from '../data/oils'
import {
  amountFromCeilingPct,
  calculateSoap,
  convertWeight,
  defaultSoapInput,
  emptyLockedResult,
  isPercentTotalLocked,
  oilsFromPercents,
  pctOfCeiling,
  percentsFromOils,
  sumOilPercents,
  weightsMatchCeiling,
  computeQualityProfile,
  computeSatRatio,
  type LyeType,
  type OilLine,
  type SoapInput,
  type SoapUnit,
  type WaterMethod,
} from '../lib/soapCalc'
import {
  ADDITIVES,
  ADDITIVE_CATEGORY_LABELS,
  additiveUsageStatus,
  getAdditive,
} from '../data/additives'
import {
  copyText,
  currentSoapSnapshot,
  formatSavedAt,
  RECIPE_FILE_ACCEPT,
  type SavedSoapRecipe,
} from '../lib/storage'
import { escapeHtml } from '../lib/htmlEscape'
import { useSoapRecipeIO } from '../hooks/useSoapRecipeIO'

type OilRow = {
  key: string
  oilId: string
  amount: string
  pct: string
}

type AdditiveRow = {
  key: string
  additiveId: string
  amount: string
}

const PRESETS: { name: string; oils: OilLine[] }[] = [
  {
    name: 'Castile-ish',
    oils: [{ oilId: 'olive', amount: 1000 }],
  },
  {
    name: 'Everyday Bar',
    oils: [
      { oilId: 'olive', amount: 400 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'palm', amount: 250 },
      { oilId: 'castor', amount: 100 },
    ],
  },
  {
    name: 'Creamy Shea',
    oils: [
      { oilId: 'olive', amount: 350 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'shea', amount: 200 },
      { oilId: 'rice-bran', amount: 150 },
      { oilId: 'castor', amount: 50 },
    ],
  },
  {
    name: 'Palm-free',
    oils: [
      { oilId: 'olive', amount: 400 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'tallow', amount: 250 },
      { oilId: 'castor', amount: 50 },
      { oilId: 'shea', amount: 50 },
    ],
  },
  {
    name: 'Luxury Butter',
    oils: [
      { oilId: 'olive', amount: 300 },
      { oilId: 'coconut', amount: 200 },
      { oilId: 'shea', amount: 150 },
      { oilId: 'cocoa', amount: 150 },
      { oilId: 'avocado', amount: 150 },
      { oilId: 'castor', amount: 50 },
    ],
  },
]

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function fmtNum(n: number, places = 2): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 10 ** places) / 10 ** places
  return String(r)
}

/** Map a quality value onto the track: the ideal band always sits 25–75%. */
function qualityBarPos(q: { value: number | null; min: number; max: number }): number {
  const span = q.max - q.min
  if (q.value == null || !(span > 0) || !Number.isFinite(q.value)) return 0
  const t = (q.value - q.min) / span
  return Math.max(0, Math.min(100, 25 + t * 50))
}

/** Build rows from weights against a fixed Total oils ceiling (not share-of-sum). */
function rowsFromWeightOils(oils: OilLine[], ceiling: number): OilRow[] {
  const pcts = percentsFromOils(oils, ceiling > 0 ? ceiling : undefined)
  return oils.map((o, i) => ({
    key: uid(),
    oilId: o.oilId,
    amount: String(o.amount),
    pct: fmtNum(pcts[i]?.pct ?? 0, 2),
  }))
}

/** Build rows from % of a fixed Total oils ceiling. */
function rowsFromPercentOils(
  lines: { oilId: string; pct: number }[],
  ceiling: number,
): OilRow[] {
  const oils = oilsFromPercents(ceiling, lines)
  return oils.map((o, i) => ({
    key: uid(),
    oilId: o.oilId,
    amount: fmtNum(o.amount, 4),
    pct: fmtNum(lines[i]?.pct ?? 0, 2),
  }))
}

function unitLabel(u: SoapUnit): string {
  if (u === 'g') return 'g'
  if (u === 'oz') return 'oz'
  return 'lb'
}

interface SoapCalculatorProps {
  onOpenWiki?: (articleId?: string) => void
  onToast?: (msg: string) => void
}

export function SoapCalculator({ onOpenWiki, onToast }: SoapCalculatorProps) {
  const defaults = defaultSoapInput()
  const defaultCeiling = defaults.oils.reduce((s, o) => s + o.amount, 0)
  const [rows, setRows] = useState<OilRow[]>(() =>
    rowsFromWeightOils(defaults.oils, defaultCeiling),
  )
  const [lyeType, setLyeType] = useState<LyeType>('naoh')
  const [superfatPct, setSuperfatPct] = useState('5')
  const [waterMethod, setWaterMethod] = useState<WaterMethod>('percent_oils')
  const [waterAsPercentOfOils, setWaterAsPercentOfOils] = useState('33')
  const [lyeConcentrationPct, setLyeConcentrationPct] = useState('33')
  const [waterDiscountPct, setWaterDiscountPct] = useState('0')
  const [fragrancePct, setFragrancePct] = useState('3')
  const [unit, setUnit] = useState<SoapUnit>('oz')
  /** Fixed recipe ceiling — never auto-rewritten when oils change. */
  const [totalOilsWeight, setTotalOilsWeight] = useState(() => fmtNum(defaultCeiling, 4))
  const [recipeName, setRecipeName] = useState('')
  const [recipeNotes, setRecipeNotes] = useState('')
  const [additiveRows, setAdditiveRows] = useState<AdditiveRow[]>([])
  const importRef = useRef<HTMLInputElement>(null)
  const {
    saved,
    showSaved,
    setShowSaved,
    activeRecipeId,
    setActiveRecipeId,
    persistSave,
    removeSaved,
    loadFromFile,
    shareOne,
    shareAll,
  } = useSoapRecipeIO(onToast)

  const u = unitLabel(unit)

  const parsedTotalOils = parseFloat(totalOilsWeight) || 0

  const weightSum = useMemo(
    () =>
      rows.reduce((s, r) => {
        if (!r.oilId) return s
        const a = parseFloat(r.amount)
        return s + (Number.isFinite(a) && a > 0 ? a : 0)
      }, 0),
    [rows],
  )

  const pctSum = useMemo(
    () => sumOilPercents(rows.filter((r) => r.oilId).map((r) => parseFloat(r.pct) || 0)),
    [rows],
  )
  const pctOk = isPercentTotalLocked(pctSum)
  const pctDelta = Math.round((pctSum - 100) * 100) / 100
  const weightsOk =
    parsedTotalOils > 0 &&
    weightsMatchCeiling(
      rows.filter((r) => r.oilId).map((r) => parseFloat(r.amount) || 0),
      parsedTotalOils,
    )
  const weightDelta = Math.round((weightSum - parsedTotalOils) * 10000) / 10000

  /** Always use typed oil weights for lye math — ceiling only gates unlock. */
  const resolvedOils: OilLine[] = useMemo(() => {
    return rows
      .filter((r) => r.oilId)
      .map((r) => ({
        oilId: r.oilId,
        amount: parseFloat(r.amount) || 0,
      }))
  }, [rows])

  const input: SoapInput = useMemo(
    () => ({
      oils: resolvedOils,
      lyeType,
      superfatPct: parseFloat(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: parseFloat(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: parseFloat(lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(waterDiscountPct) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      unit,
      additives: additiveRows
        .filter((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0)
        .map((r) => ({ additiveId: r.additiveId, amount: parseFloat(r.amount) || 0 })),
    }),
    [
      resolvedOils,
      lyeType,
      superfatPct,
      waterMethod,
      waterAsPercentOfOils,
      lyeConcentrationPct,
      waterDiscountPct,
      fragrancePct,
      unit,
      additiveRows,
    ],
  )

  const lockWarnings = useMemo(() => {
    const w: string[] = []
    if (!(parsedTotalOils > 0)) {
      w.push('Enter a Total oils weight — that is the recipe ceiling.')
    }
    if (!pctOk) {
      w.push(
        pctSum === 0
          ? 'Enter oil weights or percentages that total 100% of Total oils.'
          : 'Oil percentages must total 100% of Total oils before results unlock (currently ' +
              fmtNum(pctSum, 2) +
              '%).',
      )
    } else if (!weightsOk) {
      w.push(
        'Oil weights must add up to Total oils (' +
          fmtNum(parsedTotalOils, 4) +
          ' ' +
          u +
          ') — currently ' +
          fmtNum(weightSum, 4) +
          ' ' +
          u +
          '.',
      )
    }
    return w
  }, [parsedTotalOils, pctOk, pctSum, weightsOk, weightSum, u])

  const result = useMemo(() => {
    if (lockWarnings.length > 0) {
      return emptyLockedResult(lockWarnings)
    }
    return calculateSoap(input)
  }, [lockWarnings, input])

  /** Soapcalc-style quality profile (7 qualities) + sat:unsat ratio. */
  const quality = useMemo(
    () =>
      result.locked
        ? []
        : computeQualityProfile(resolvedOils, result.weightedIodine, result.weightedIns),
    [result.locked, resolvedOils, result.weightedIodine, result.weightedIns],
  )
  const satRatio = useMemo(
    () => (result.locked ? null : computeSatRatio(resolvedOils)),
    [result.locked, resolvedOils],
  )

  /**
   * Edit weight → recompute only that row's % from ceiling.
   * Never touches other oils or Total oils.
   */
  function updateRowWeight(key: string, amountStr: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const amount = parseFloat(amountStr)
        const pct =
          parsedTotalOils > 0 && Number.isFinite(amount)
            ? pctOfCeiling(amount > 0 ? amount : 0, parsedTotalOils)
            : 0
        return {
          ...r,
          amount: amountStr,
          pct: fmtNum(pct, 2),
        }
      }),
    )
  }

  /**
   * Edit % → recompute only that row's weight from ceiling.
   * Never touches other oils or Total oils.
   */
  function updateRowPct(key: string, pctStr: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const pct = parseFloat(pctStr)
        const amount =
          parsedTotalOils > 0 && Number.isFinite(pct)
            ? amountFromCeilingPct(pct > 0 ? pct : 0, parsedTotalOils)
            : 0
        return {
          ...r,
          pct: pctStr,
          amount: fmtNum(amount, 4),
        }
      }),
    )
  }

  function updateRowOil(key: string, oilId: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, oilId } : r)))
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: uid(),
        oilId: '',
        amount: '0',
        pct: '0',
      },
    ])
  }

  function addAdditiveRow(additiveId = '') {
    setAdditiveRows((prev) => [
      ...prev,
      {
        key: uid(),
        additiveId,
        amount: '',
      },
    ])
  }

  function updateAdditiveId(key: string, additiveId: string) {
    setAdditiveRows((prev) => prev.map((r) => (r.key === key ? { ...r, additiveId } : r)))
  }

  function updateAdditiveAmount(key: string, amountStr: string) {
    setAdditiveRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount: amountStr } : r)))
  }

  function removeAdditiveRow(key: string) {
    setAdditiveRows((prev) => prev.filter((r) => r.key !== key))
  }

  function removeRow(key: string) {
    // Removing a row does not rewrite remaining oils or the ceiling.
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  function applyPreset(oils: OilLine[], name?: string) {
    // Presets are authored in grams; convert into the active unit (default oz).
    const converted = oils.map((o) => ({
      oilId: o.oilId,
      amount: convertWeight(o.amount, 'g', unit),
    }))
    const total = converted.reduce((s, o) => s + o.amount, 0)
    setTotalOilsWeight(fmtNum(total, 4))
    setRows(rowsFromWeightOils(converted, total))
    // Presets are oil-only formulas — drop leftover add-ins from the previous recipe.
    setAdditiveRows([])
    if (name) setRecipeName(name)
    // Preset is a new working copy — don't overwrite a previously loaded library slot.
    setActiveRecipeId(null)
    onToast?.(name ? name + ' loaded' : 'Preset loaded')
  }

  /**
   * True blank formula: no preset oils/butters preloaded.
   * Keeps unit, lye, water method, and total oils ceiling.
   */
  function startCustomRecipe() {
    const total =
      parsedTotalOils > 0 ? parsedTotalOils : unit === 'lb' ? 2 : unit === 'oz' ? 32 : 1000
    setRows([])
    setAdditiveRows([])
    setTotalOilsWeight(fmtNum(total, 4))
    setRecipeName('Custom')
    setRecipeNotes('')
    setActiveRecipeId(null)
    setShowSaved(false)
    onToast?.('Custom — empty recipe. Add oils; Total oils is the ceiling')
  }

  /**
   * User is changing the ceiling. Keep each oil's % of the old recipe and
   * recompute weights for the new total — only when they explicitly edit Total oils.
   * (Does not run when typing individual oil weights.)
   */
  function onTotalOilsChange(value: string) {
    const prevCeiling = parsedTotalOils
    const nextCeiling = parseFloat(value) || 0
    setTotalOilsWeight(value)
    if (!(nextCeiling > 0)) return
    setRows((prev) =>
      prev.map((r) => {
        const pct = parseFloat(r.pct)
        // Prefer stored % (stable across ceiling edits). Fall back to old weight/ceiling.
        let usePct = Number.isFinite(pct) ? pct : 0
        if (!(usePct > 0) && prevCeiling > 0) {
          const amt = parseFloat(r.amount) || 0
          usePct = pctOfCeiling(amt, prevCeiling)
        }
        return {
          ...r,
          pct: fmtNum(usePct, 2),
          amount: fmtNum(amountFromCeilingPct(usePct > 0 ? usePct : 0, nextCeiling), 4),
        }
      }),
    )
  }

  /** Optional: force every weight = % × ceiling (same as re-applying current %). */
  function applyPercentsToCeiling() {
    const target = parseFloat(totalOilsWeight)
    if (!target || target <= 0) {
      onToast?.('Enter a Total oils weight first')
      return
    }
    if (!pctOk) {
      onToast?.('Oil % must total 100% before applying')
      return
    }
    setRows((prev) =>
      prev.map((r) => {
        const pct = parseFloat(r.pct) || 0
        return {
          ...r,
          amount: fmtNum(amountFromCeilingPct(pct, target), 4),
          pct: fmtNum(pct, 2),
        }
      }),
    )
    onToast?.('Weights set from % × Total oils')
  }

  /** Optional: scale current weights so they sum exactly to the ceiling (keeps ratios). */
  function scaleWeightsToCeiling() {
    const target = parseFloat(totalOilsWeight)
    if (!target || target <= 0) {
      onToast?.('Enter a Total oils weight first')
      return
    }
    const current = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (!(current > 0)) {
      onToast?.('Add oil weights before scaling')
      return
    }
    const factor = target / current
    setRows((prev) =>
      prev.map((r) => {
        const amount = (parseFloat(r.amount) || 0) * factor
        return {
          ...r,
          amount: fmtNum(amount, 4),
          pct: fmtNum(pctOfCeiling(amount, target), 2),
        }
      }),
    )
    onToast?.('Scaled oils to Total oils (' + fmtNum(target, 4) + ' ' + u + ')')
  }

  function resetDefaults() {
    const d = defaultSoapInput()
    const total = d.oils.reduce((s, o) => s + o.amount, 0)
    setLyeType(d.lyeType)
    setSuperfatPct(String(d.superfatPct))
    setWaterMethod(d.waterMethod)
    setWaterAsPercentOfOils(String(d.waterAsPercentOfOils))
    setLyeConcentrationPct(String(d.lyeConcentrationPct))
    setWaterDiscountPct(String(d.waterDiscountPct))
    setFragrancePct(String(d.fragrancePct))
    setUnit(d.unit)
    setTotalOilsWeight(fmtNum(total, 4))
    setRows(rowsFromWeightOils(d.oils, total))
    setRecipeName('')
    setRecipeNotes('')
    setAdditiveRows([])
    setActiveRecipeId(null)
    onToast?.('Soap calculator reset')
  }

  function onUnitChange(next: SoapUnit) {
    if (next === unit) return
    const st = parseFloat(totalOilsWeight)
    const nextCeiling =
      Number.isFinite(st) && st > 0 ? convertWeight(st, unit, next) : 0
    setRows((prev) =>
      prev.map((r) => {
        const n = parseFloat(r.amount)
        if (!Number.isFinite(n)) return r
        const amount = convertWeight(n, unit, next)
        return {
          ...r,
          amount: fmtNum(amount, 4),
          // % of ceiling is unit-invariant; recompute from converted mass for safety
          pct: fmtNum(pctOfCeiling(amount, nextCeiling > 0 ? nextCeiling : 0), 2),
        }
      }),
    )
    // Additives are stored in the recipe unit too — convert with oils/ceiling.
    setAdditiveRows((prev) =>
      prev.map((r) => {
        const n = parseFloat(r.amount)
        if (!Number.isFinite(n) || r.amount.trim() === '') return r
        return { ...r, amount: fmtNum(convertWeight(n, unit, next), 4) }
      }),
    )
    if (nextCeiling > 0) {
      setTotalOilsWeight(fmtNum(nextCeiling, 4))
    }
    setUnit(next)
  }

  function snapshotOils() {
    return rows
      .filter((r) => r.oilId)
      .map((r) => ({
        oilId: r.oilId,
        amount: parseFloat(r.amount) || 0,
        pct: parseFloat(r.pct) || 0,
      }))
  }

  function snapshotAdditives() {
    return additiveRows
      .filter((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0)
      .map((r) => ({
        additiveId: r.additiveId,
        amount: parseFloat(r.amount) || 0,
      }))
  }

  function handleSave() {
    const recipe = persistSave({
      name: recipeName.trim() || 'Soap ' + new Date().toLocaleDateString(),
      oils: snapshotOils(),
      lyeType,
      superfatPct: parseFloat(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: parseFloat(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: parseFloat(lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(waterDiscountPct) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      unit,
      oilEntryMode: 'dual',
      totalOilsWeight: parsedTotalOils > 0 ? parsedTotalOils : undefined,
      notes: recipeNotes.trim() || undefined,
      additives: snapshotAdditives(),
    })
    if (recipe) setRecipeName(recipe.name)
  }

  function loadRecipe(r: SavedSoapRecipe) {
    const nextUnit: SoapUnit =
      r.unit === 'g' || r.unit === 'lb' || r.unit === 'oz' ? r.unit : 'oz'
    const totalFromRecipe =
      r.totalOilsWeight != null && r.totalOilsWeight > 0
        ? r.totalOilsWeight
        : r.oils.reduce((s, o) => s + (o.amount > 0 ? o.amount : 0), 0)

    // Prefer saved % of ceiling when present; else derive from weights ÷ ceiling.
    // Legacy "percent" packs may only have % — fill weights from ceiling.
    const preferPct = r.oilEntryMode === 'percent'
    let nextRows: OilRow[]
    if (preferPct && totalFromRecipe > 0) {
      const lines = r.oils.map((o) => ({
        oilId: o.oilId,
        pct: o.pct != null && o.pct > 0 ? o.pct : pctOfCeiling(o.amount, totalFromRecipe),
      }))
      nextRows = rowsFromPercentOils(lines, totalFromRecipe)
    } else {
      nextRows = r.oils.map((o) => {
        const amount = o.amount > 0 ? o.amount : 0
        const pct =
          o.pct != null && o.pct > 0
            ? o.pct
            : totalFromRecipe > 0
              ? pctOfCeiling(amount, totalFromRecipe)
              : 0
        return {
          key: uid(),
          oilId: o.oilId,
          amount: String(amount),
          pct: fmtNum(pct, 2),
        }
      })
      // If amounts were empty but % exist, materialize weights from ceiling.
      if (
        totalFromRecipe > 0 &&
        nextRows.every((row) => !(parseFloat(row.amount) > 0)) &&
        nextRows.some((row) => parseFloat(row.pct) > 0)
      ) {
        nextRows = rowsFromPercentOils(
          nextRows.map((row) => ({ oilId: row.oilId, pct: parseFloat(row.pct) || 0 })),
          totalFromRecipe,
        )
      }
    }

    setTotalOilsWeight(
      totalFromRecipe > 0
        ? fmtNum(totalFromRecipe, 4)
        : fmtNum(unit === 'lb' ? 2 : unit === 'oz' ? 32 : 1000, 4),
    )
    setRows(nextRows)
    setLyeType(r.lyeType)
    setSuperfatPct(String(r.superfatPct))
    setWaterMethod(r.waterMethod)
    setWaterAsPercentOfOils(String(r.waterAsPercentOfOils))
    setLyeConcentrationPct(String(r.lyeConcentrationPct))
    setWaterDiscountPct(String(r.waterDiscountPct))
    setFragrancePct(String(r.fragrancePct))
    setUnit(nextUnit)
    setRecipeName(r.name)
    setRecipeNotes(r.notes || '')
    setAdditiveRows(
      (r.additives ?? []).map((a) => ({
        key: uid(),
        additiveId: a.additiveId,
        amount: String(a.amount),
      })),
    )
    setActiveRecipeId(r.id)
    setShowSaved(false)
    onToast?.(`Loaded “${r.name}”`)
  }

  function handleDelete(id: string) {
    removeSaved(id)
  }

  const currentSoapRecipe = useCallback((): SavedSoapRecipe => {
    return currentSoapSnapshot({
      id: activeRecipeId || undefined,
      name: recipeName.trim() || 'Soap ' + new Date().toLocaleDateString(),
      oils: snapshotOils(),
      lyeType,
      superfatPct: parseFloat(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: parseFloat(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: parseFloat(lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(waterDiscountPct) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      unit,
      oilEntryMode: 'dual',
      totalOilsWeight: parsedTotalOils > 0 ? parsedTotalOils : undefined,
      notes: recipeNotes.trim() || undefined,
      additives: snapshotAdditives(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeRecipeId,
    recipeName,
    rows,
    lyeType,
    superfatPct,
    waterMethod,
    waterAsPercentOfOils,
    lyeConcentrationPct,
    waterDiscountPct,
    fragrancePct,
    unit,
    parsedTotalOils,
    recipeNotes,
    additiveRows,
  ])

  const formatRecipeText = useCallback(() => {
    const lyeName = lyeType === 'naoh' ? 'NaOH' : 'KOH'
    const oilLines = rows
      .filter((r) => r.oilId)
      .map((r) => {
        const oil = getOil(r.oilId)
        const amt = parseFloat(r.amount) || 0
        const pct = parseFloat(r.pct) || 0
        return (
          '  • ' +
          (oil?.name || r.oilId) +
          ': ' +
          fmtNum(amt, 4) +
          ' ' +
          u +
          ' (' +
          fmtNum(pct, 2) +
          '%)'
        )
      })
    const lines = [
      "Alex's Craft Calc — Soap Recipe" + (recipeName ? ': ' + recipeName : ''),
      'Unit: ' +
        u +
        ' · Lye: ' +
        lyeName +
        ' · Superfat: ' +
        superfatPct +
        '% · FO: ' +
        fragrancePct +
        '%',
      'Water method: ' + waterMethod,
      'Total oils ceiling: ' + (parsedTotalOils || result.totalOils) + ' ' + u,
      'Oil weight sum: ' + fmtNum(weightSum, 4) + ' ' + u + ' · Oil % sum: ' + fmtNum(pctSum, 2) + '%',
      '',
      'Oils:',
      ...oilLines,
      ...(additiveRows.some((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0)
        ? [
            '',
            'Additives:',
            ...additiveRows
              .filter((r) => r.additiveId && (parseFloat(r.amount) || 0) > 0)
              .map((r) => {
                const add = getAdditive(r.additiveId)
                const amt = parseFloat(r.amount) || 0
                return '  • ' + (add?.name || r.additiveId) + ': ' + fmtNum(amt, 4) + ' ' + u
              }),
          ]
        : []),
      '',
      result.locked
        ? 'Results locked — oil weights/% must match Total oils ceiling (100%).'
        : [
            'Total oils: ' + result.totalOils + ' ' + u,
            lyeName + ' (with SF): ' + result.lyeWithSuperfat + ' ' + u,
            'Pure lye 0% SF: ' + result.pureLye + ' ' + u,
            'Water: ' + result.water + ' ' + u,
            'Lye solution: ' + result.lyeSolution + ' ' + u,
            'Fragrance: ' + result.fragrance + ' ' + u,
            'Batch total: ' + result.totalBatch + ' ' + u,
            result.weightedIodine != null ? 'Weighted iodine: ' + result.weightedIodine : '',
            result.weightedIns != null ? 'Weighted INS: ' + result.weightedIns : '',
          ]
            .filter(Boolean)
            .join('\n'),
      recipeNotes.trim() ? '\nNotes:\n' + recipeNotes.trim() : '',
      '',
      'Always add lye to water. Wear PPE. Verify SAP with supplier COA.',
    ]
    return lines.filter((x) => x !== '').join('\n')
  }, [
    recipeName,
    u,
    lyeType,
    superfatPct,
    fragrancePct,
    waterMethod,
    result,
    rows,
    parsedTotalOils,
    weightSum,
    pctSum,
    recipeNotes,
    additiveRows,
  ])

  async function handleCopy() {
    const ok = await copyText(formatRecipeText())
    onToast?.(ok ? 'Recipe copied to clipboard' : 'Copy failed')
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900')
    if (!w) {
      onToast?.('Pop-up blocked — allow pop-ups to print')
      return
    }
    const html =
      '<!doctype html><html><head><title>Soap Recipe</title>' +
      '<style>' +
      'body{font-family:Segoe UI,system-ui,sans-serif;padding:2rem;color:#1a0a2e;line-height:1.5}' +
      'h1{color:#6b21a8;font-size:1.4rem}' +
      'pre{white-space:pre-wrap;background:#f5e9ff;padding:1rem;border-radius:12px}' +
      '.note{font-size:0.85rem;color:#666;margin-top:1.5rem}' +
      '</style></head><body>' +
      "<h1>Alex's Craft Calc — Soap</h1>" +
      '<pre>' +
      escapeHtml(formatRecipeText()) +
      '</pre>' +
      '<p class="note">Craft planning only. Verify SAP values. Lye is caustic.</p>' +
      '<script>onload=()=>{print();}</script>' +
      '</body></html>'
    w.document.write(html)
    w.document.close()
  }

  /** Load = pick a recipe/library file and merge into Saved (replaces Import). */
  async function handleLoadFile(file: File | null) {
    if (!file) return
    try {
      const result = await loadFromFile(file)
      if (!result) return
      const { parsed, merged, summary } = result
      if (
        merged.lastSoap &&
        parsed.kind === 'soap' &&
        parsed.soapCount === 1 &&
        parsed.candleCount === 0
      ) {
        loadRecipe(merged.lastSoap)
      }
      onToast?.(summary)
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  /** Share current recipe via OS share sheet (phone) or download (desktop). */
  async function handleShare() {
    await shareOne(currentSoapRecipe(), formatRecipeText())
  }

  /** Share full soap+candle library backup (long-press Share or saved-list action). */
  async function handleShareLibrary() {
    await shareAll()
  }

  const recipeBalanced = pctOk && weightsOk && parsedTotalOils > 0
  const pctStatusClass = recipeBalanced
    ? 'pct-status ok'
    : parsedTotalOils > 0
      ? 'pct-status bad'
      : 'pct-status'

  return (
    <div className="calc-panel soap-panel">
      <header className="panel-head">
        <div>
          <h2>Soap Calculator</h2>
          <p className="muted">Cold-process lye, water & fragrance — live as you type.</p>
        </div>
        <div className="head-actions">
          <div className="unit-tabs" role="group" aria-label="Weight unit">
            {(['g', 'oz', 'lb'] as SoapUnit[]).map((opt) => (
              <button
                key={opt}
                type="button"
                className={'unit-tab' + (unit === opt ? ' active' : '')}
                onClick={() => onUnitChange(opt)}
              >
                {opt === 'g' ? 'g' : opt === 'oz' ? 'oz' : 'lb'}
              </button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => onOpenWiki?.('app-soap-ui')}>
            Help
          </button>
          <button type="button" className="ghost" onClick={resetDefaults}>
            Reset
          </button>
        </div>
      </header>

      <section className="card toolbar-card">
        <div className="toolbar-row">
          <label className="grow">
            Recipe name
            <input
              type="text"
              placeholder="e.g. Lavender everyday bar"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              maxLength={120}
            />
          </label>
          <div className="toolbar-btns">
            <button type="button" className="chip solid" onClick={handleSave}>
              {activeRecipeId ? 'Update' : 'Save'}
            </button>
            <button type="button" className="chip" onClick={() => setShowSaved((v) => !v)}>
              {showSaved ? 'Hide saved' : `Saved (${saved.length})`}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => importRef.current?.click()}
              title="Load a recipe or library backup file into Saved"
            >
              Load
            </button>
            <button
              type="button"
              className="chip"
              onClick={handleShare}
              onContextMenu={(e) => {
                e.preventDefault()
                void handleShareLibrary()
              }}
              title="Share recipe (phone share sheet or download). Right-click / long-press: share full library"
            >
              Share
            </button>
            <button type="button" className="chip" onClick={handleCopy} title="Copy batch text">
              Copy
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              Print
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept={RECIPE_FILE_ACCEPT}
            className="sr-only"
            aria-label="Load recipe or library file"
            onChange={(e) => void handleLoadFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <label className="notes-field">
          Custom recipe notes
          <textarea
            rows={3}
            maxLength={4000}
            placeholder="Batch notes, scent blend, colorants, cure log, mold, customer order…"
            value={recipeNotes}
            onChange={(e) => setRecipeNotes(e.target.value)}
          />
        </label>
        {activeRecipeId && (
          <p className="hint recipe-slot-hint">
            Editing saved recipe — Save updates this library slot (or rename to keep both).
          </p>
        )}
        {showSaved && (
          <div className="saved-list">
            {saved.length === 0 && <p className="hint">No saved soap recipes yet.</p>}
            {saved.length > 0 && (
              <div className="saved-list-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => void handleShareLibrary()}
                  title="Share or download every saved soap + candle recipe"
                >
                  Share library
                </button>
              </div>
            )}
            {saved.map((r) => (
              <div
                key={r.id}
                className={'saved-item' + (r.id === activeRecipeId ? ' active' : '')}
                aria-current={r.id === activeRecipeId ? 'true' : undefined}
              >
                <button type="button" className="saved-load" onClick={() => loadRecipe(r)}>
                  <strong>{r.name}</strong>
                  <span>
                    {r.oils.length} oils · {r.lyeType.toUpperCase()} · SF {r.superfatPct}%
                    {r.totalOilsWeight != null ? ` · ${fmtNum(r.totalOilsWeight, 2)} ${r.unit}` : ''}
                    {formatSavedAt(r.savedAt) ? ` · ${formatSavedAt(r.savedAt)}` : ''}
                  </span>
                  {r.notes ? <span className="notes-chip">notes</span> : null}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={'Delete ' + r.name}
                  onClick={() => handleDelete(r.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card weight-of-oils-card">
        <div className="card-title-row">
          <h3>Weight of oils</h3>
          <span className="ceiling-badge" title="Recipe ceiling — oils must add up to this">
            Ceiling
          </span>
        </div>

        <div className="total-oils-row">
          <label className="grow">
            Total oils weight ({u})
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={totalOilsWeight}
              onChange={(e) => onTotalOilsChange(e.target.value)}
              placeholder={unit === 'lb' ? '2' : unit === 'oz' ? '32' : '1000'}
            />
          </label>
          <div className="total-oils-actions">
            <button
              type="button"
              className="chip solid"
              onClick={scaleWeightsToCeiling}
              title="Scale current oil weights so they sum to Total oils (keeps ratios)"
            >
              Scale weights to total
            </button>
            <button
              type="button"
              className="chip"
              onClick={applyPercentsToCeiling}
              title="Set each oil weight from its % × Total oils"
            >
              Apply % to weights
            </button>
          </div>
          <p className="hint full">
            <strong>Total oils</strong> is the recipe ceiling — it does not change when you type individual oils.
            Edit <strong>weight</strong> or <strong>%</strong> on any row (both always live). Changing one field
            updates only that oil against the ceiling; other oils stay put. Results unlock when oil weights and
            percentages both match this total (100%).
          </p>
        </div>

        <div className="card-title-row oils-subhead">
          <h3>Oils & butters</h3>
          <div className="preset-row" role="group" aria-label="Recipe presets">
            <button
              type="button"
              className="chip solid custom-recipe-btn"
              onClick={startCustomRecipe}
              title="Start empty — no oils or butters preloaded"
            >
              Custom
            </button>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="chip"
                onClick={() => applyPreset(p.oils, p.name)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="oil-table mode-dual">
          <div className="oil-head">
            <span>Oil</span>
            <span>Weight ({u})</span>
            <span>% of total</span>
            <span />
          </div>
          {rows.length === 0 && (
            <div className="oil-empty-state">
              <p>No oils yet — this is a blank custom recipe.</p>
              <button type="button" className="chip solid" onClick={addRow}>
                + Add first oil
              </button>
            </div>
          )}
          {rows.map((row) => {
            const oil = getOil(row.oilId)
            const linePctNum = parseFloat(row.pct) || 0
            const overMax =
              oil?.maxPct != null && linePctNum > 0 && linePctNum > oil.maxPct + 0.05
            return (
              <div className="oil-row" key={row.key}>
                <div className="oil-select-wrap">
                  <select
                    value={row.oilId}
                    onChange={(e) => updateRowOil(row.key, e.target.value)}
                    aria-label="Select oil or butter"
                  >
                    <option value="">— Select oil —</option>
                    {OILS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="info-chip"
                    title={oil?.notes || 'Oil info'}
                    aria-label={'Wiki: ' + (oil?.name || 'oil')}
                    disabled={!row.oilId}
                    onClick={() => row.oilId && onOpenWiki?.('oil-' + row.oilId)}
                  >
                    i
                  </button>
                </div>
                <input
                  type="number"
                  className="weight-input"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => updateRowWeight(row.key, e.target.value)}
                  aria-label={'Weight ' + (oil?.name || '')}
                />
                <div className="pct-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    className={'pct-input' + (overMax ? ' warn-input' : '')}
                    value={row.pct}
                    onChange={(e) => updateRowPct(row.key, e.target.value)}
                    aria-label={'Percent of total ' + (oil?.name || '')}
                  />
                  <span className="pct-suffix">%</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove oil"
                  onClick={() => removeRow(row.key)}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
        <div className="oil-table-footer">
          <button type="button" className="add-btn" onClick={addRow}>
            + Add oil
          </button>
          <div className={pctStatusClass} role="status">
            <span>
              Oil %: <strong>{fmtNum(pctSum, 2)}%</strong>
              {' · '}
              Weights: <strong>{fmtNum(weightSum, 4)} {u}</strong>
              {' / '}
              <strong>{fmtNum(parsedTotalOils, 4)} {u}</strong>
            </span>
            <span className="pct-hint">
              {recipeBalanced
                ? 'Unlocked — matches Total oils ceiling'
                : !parsedTotalOils
                  ? 'Set Total oils ceiling'
                  : !pctOk
                    ? pctDelta > 0
                      ? fmtNum(pctDelta, 2) + '% over 100% — locked'
                      : fmtNum(Math.abs(pctDelta), 2) + '% short of 100% — locked'
                    : weightDelta > 0
                      ? fmtNum(weightDelta, 4) + ' ' + u + ' over ceiling — locked'
                      : fmtNum(Math.abs(weightDelta), 4) + ' ' + u + ' under ceiling — locked'}
            </span>
          </div>
        </div>
      </section>

      <section className="card additives-card">
        <div className="card-title-row">
          <h3>Additives & add-ins</h3>
          <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-additives')}>
            Additive guide
          </button>
        </div>
        <p className="hint">
          Ground oats, clays, milks, salts, sugars, botanicals — weighed in {u}, checked as % of
          oils. Amounts are added to your batch total; anything outside the recommended range is
          flagged in results.
        </p>
        {additiveRows.length === 0 && (
          <p className="hint">None yet — pick an additive below (colloidal oats, kaolin, honey…).</p>
        )}
        {additiveRows.map((row) => {
          const add = getAdditive(row.additiveId)
          const amt = parseFloat(row.amount) || 0
          const pctOfOils = parsedTotalOils > 0 && amt > 0 ? (amt / parsedTotalOils) * 100 : 0
          const usage = add ? additiveUsageStatus(pctOfOils, add.usagePct) : 'n/a'
          const usageCls = usage === 'good' ? 'ok' : usage
          const usageLabel =
            usage === 'good'
              ? `OK · ${add!.usagePct.min}–${add!.usagePct.max}%`
              : usage === 'low'
                ? `Low · need ${add!.usagePct.min}–${add!.usagePct.max}%`
                : usage === 'high'
                  ? `High · max ${add!.usagePct.max}%`
                  : '—'
          return (
            <div className="additive-row" key={row.key}>
              <div className="additive-select-wrap">
                <select
                  value={row.additiveId}
                  onChange={(e) => updateAdditiveId(row.key, e.target.value)}
                  aria-label="Select additive"
                >
                  <option value="">— Select additive —</option>
                  {Object.entries(ADDITIVE_CATEGORY_LABELS).map(([cat, label]) => (
                    <optgroup key={cat} label={label}>
                      {ADDITIVES.filter((a) => a.category === cat).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.usagePct.min}–{a.usagePct.max}%)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  className="info-chip"
                  title={add?.benefits || 'Additive info'}
                  aria-label={'Wiki: ' + (add?.name || 'additive')}
                  disabled={!row.additiveId}
                  onClick={() => row.additiveId && onOpenWiki?.('soap-additives')}
                >
                  i
                </button>
              </div>
              <div className="pct-input-wrap additive-amount-wrap">
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className="weight-input"
                  value={row.amount}
                  onChange={(e) => updateAdditiveAmount(row.key, e.target.value)}
                  aria-label={'Amount ' + (add?.name || '')}
                  placeholder="0"
                />
                <span className="pct-suffix">{u}</span>
              </div>
              <span className={'additive-status ' + usageCls}>{usageLabel}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove additive"
                onClick={() => removeAdditiveRow(row.key)}
              >
                ×
              </button>
            </div>
          )
        })}
        <div className="additive-table-footer">
          <select
            className="additive-add-select"
            value=""
            onChange={(e) => {
              if (e.target.value) addAdditiveRow(e.target.value)
            }}
            aria-label="Add additive"
          >
            <option value="">+ Add additive…</option>
            {Object.entries(ADDITIVE_CATEGORY_LABELS).map(([cat, label]) => (
              <optgroup key={cat} label={label}>
                {ADDITIVES.filter((a) => a.category === cat).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.usagePct.min}–{a.usagePct.max}%)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="add-btn" onClick={() => addAdditiveRow()}>
            + Additive
          </button>
        </div>
      </section>

      <div className="split-grid">
        <section className="card">
          <h3>Lye & superfat</h3>
          <div className="field-grid">
            <label>
              Lye type
              <select value={lyeType} onChange={(e) => setLyeType(e.target.value as LyeType)}>
                <option value="naoh">NaOH (bar)</option>
                <option value="koh">KOH (liquid)</option>
              </select>
            </label>
            <label>
              Superfat %
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={superfatPct}
                onChange={(e) => setSuperfatPct(e.target.value)}
              />
            </label>
            <label>
              Fragrance % of oils
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={fragrancePct}
                onChange={(e) => setFragrancePct(e.target.value)}
              />
            </label>
            <p className="hint full">
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-superfat')}>
                Superfat guide
              </button>
              {' · '}
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-lye-safety')}>
                Lye safety
              </button>
            </p>
          </div>
        </section>

        <section className="card">
          <h3>Water</h3>
          <div className="field-grid">
            <label className="full">
              Method
              <select
                value={waterMethod}
                onChange={(e) => setWaterMethod(e.target.value as WaterMethod)}
              >
                <option value="percent_oils">Water as % of oils</option>
                <option value="lye_concentration">Lye concentration</option>
                <option value="discount">Water discount (from 38%)</option>
              </select>
            </label>
            {waterMethod === 'percent_oils' && (
              <label>
                Water % of oils
                <input
                  type="number"
                  min="20"
                  max="45"
                  step="0.5"
                  value={waterAsPercentOfOils}
                  onChange={(e) => setWaterAsPercentOfOils(e.target.value)}
                />
              </label>
            )}
            {waterMethod === 'lye_concentration' && (
              <label>
                Lye concentration %
                <input
                  type="number"
                  min="25"
                  max="50"
                  step="0.5"
                  value={lyeConcentrationPct}
                  onChange={(e) => setLyeConcentrationPct(e.target.value)}
                />
              </label>
            )}
            {waterMethod === 'discount' && (
              <label>
                Water discount %
                <input
                  type="number"
                  min="0"
                  max="40"
                  step="1"
                  value={waterDiscountPct}
                  onChange={(e) => setWaterDiscountPct(e.target.value)}
                />
              </label>
            )}
            <p className="hint full">
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-water')}>
                Water methods explained
              </button>
            </p>
          </div>
        </section>
      </div>

      <section className={'card results-card' + (result.locked ? ' results-locked' : '')}>
        <div className="card-title-row">
          <h3>Batch results</h3>
          <div className="toolbar-btns">
            <button type="button" className="chip" onClick={handleCopy} disabled={!!result.locked}>
              Copy results
            </button>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <ul className="warnings">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="stat-grid">
          <div className="stat hero">
            <span className="stat-label">{lyeType === 'naoh' ? 'NaOH' : 'KOH'} (with SF)</span>
            <span className="stat-value">
              {result.locked ? '—' : result.lyeWithSuperfat}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Water</span>
            <span className="stat-value">
              {result.locked ? '—' : result.water}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Lye solution</span>
            <span className="stat-value">
              {result.locked ? '—' : result.lyeSolution}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Fragrance</span>
            <span className="stat-value">
              {result.locked ? '—' : result.fragrance}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Total oils</span>
            <span className="stat-value">
              {result.locked ? fmtNum(parsedTotalOils, 2) : result.totalOils}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Batch total</span>
            <span className="stat-value">
              {result.locked ? '—' : result.totalBatch}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Additives</span>
            <span className="stat-value">
              {result.locked ? '—' : result.additiveTotal}
              <small>{u}</small>
            </span>
          </div>
        </div>
        <div className="meta-row">
          <span>
            Pure lye 0% SF:{' '}
            <strong>{result.locked ? '—' : result.pureLye + ' ' + u}</strong>
          </span>
          {result.weightedIodine != null && (
            <span>
              Iodine: <strong>{result.weightedIodine}</strong>
            </span>
          )}
          {result.weightedIns != null && (
            <span>
              INS: <strong>{result.weightedIns}</strong>
            </span>
          )}
        </div>
        {!result.locked && quality.length > 0 && (
          <div className="quality-panel">
            <div className="quality-head">
              <h4>Quality profile</h4>
              <button
                type="button"
                className="linkish"
                onClick={() => onOpenWiki?.('soap-quality')}
              >
                How to read this
              </button>
            </div>
            <div className="quality-grid">
              {quality.map((q) => (
                <div key={q.key} className={'quality-metric ' + q.status}>
                  <div className="quality-top">
                    <span className="quality-label">{q.label}</span>
                    <span className="quality-value">
                      {q.value == null ? '—' : q.value}
                      <small>
                        {' '}
                        ideal {q.min}–{q.max}
                      </small>
                    </span>
                  </div>
                  <div className="quality-track">
                    <div className="quality-band" />
                    <div
                      className="quality-marker"
                      style={{ left: qualityBarPos(q) + '%' }}
                      title={
                        q.status === 'good'
                          ? 'In ideal range'
                          : q.status === 'low'
                            ? 'Below ideal range'
                            : 'Above ideal range'
                      }
                    />
                  </div>
                  {q.status !== 'good' && <p className="quality-hint">{q.hint}</p>}
                </div>
              ))}
            </div>
            {satRatio != null && (
              <p className="quality-ratio">
                Saturated : unsaturated ≈{' '}
                <strong>
                  {fmtNum(satRatio.sat, 0)}:{fmtNum(satRatio.unsat, 0)}
                </strong>{' '}
                — a typical balanced bar sits near 40:60.
              </p>
            )}
          </div>
        )}
        {!result.locked && result.oilBreakdown.length > 0 && (
          <div className="breakdown">
            <h4>Oil breakdown</h4>
            <ul>
              {result.oilBreakdown.map((b) => (
                <li key={b.oilId + b.name}>
                  <button type="button" className="linkish" onClick={() => onOpenWiki?.('oil-' + b.oilId)}>
                    {b.name}
                  </button>
                  <span>
                    {b.amount} {u} · {b.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!result.locked && result.additives.length > 0 && (
          <div className="breakdown">
            <h4>Additives & add-ins</h4>
            <ul>
              {result.additives.map((a) => (
                <li key={a.additiveId}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => onOpenWiki?.('soap-additives')}
                  >
                    {a.name}
                  </button>
                  <span className={'additive-status ' + a.status}>
                    {a.amount} {u} · {a.pctOfOils}% of oils ·{' '}
                    {a.status === 'ok'
                      ? `within ${a.usageMin}–${a.usageMax}%`
                      : a.status === 'low'
                        ? `below recommended ${a.usageMin}–${a.usageMax}%`
                        : `above recommended ${a.usageMin}–${a.usageMax}%`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
