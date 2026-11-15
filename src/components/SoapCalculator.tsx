import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OILS, getOil } from '../data/oils'
import {
  additiveAmountInRecipeUnit,
  amountFromCeilingPct,
  calculateSoap,
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
  computeQualityProfile,
  computeSatRatio,
  type AdditiveAmountUnit,
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
  isAdditiveVolumeUnit,
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
import { useI18n } from '../i18n/I18nProvider'
import { formatEditable, formatNumber, reformatEditable } from '../i18n/format'
import { parseUserDecimal } from '../lib/parseDecimal'
import { additiveDisplayName, oilDisplayName, tx } from '../i18n/content'
import {
  importHasChanges,
  localizeImportSummary,
  localizeRuntimeMessage,
} from '../i18n/runtimeMessages'
import type { ToastFn } from './Toast'
import { RichText } from './RichText'

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
  /** Entry unit for amount — weight (g/oz/lb) or kitchen spoon (tsp/tbsp). */
  amountUnit: AdditiveAmountUnit
}

const PRESETS: { id: string; oils: OilLine[] }[] = [
  {
    id: 'castile',
    oils: [{ oilId: 'olive', amount: 1000 }],
  },
  {
    id: 'everyday',
    oils: [
      { oilId: 'olive', amount: 400 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'palm', amount: 250 },
      { oilId: 'castor', amount: 100 },
    ],
  },
  {
    id: 'shea',
    oils: [
      { oilId: 'olive', amount: 350 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'shea', amount: 200 },
      { oilId: 'rice-bran', amount: 150 },
      { oilId: 'castor', amount: 50 },
    ],
  },
  {
    id: 'palmfree',
    oils: [
      { oilId: 'olive', amount: 400 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'tallow', amount: 250 },
      { oilId: 'castor', amount: 50 },
      { oilId: 'shea', amount: 50 },
    ],
  },
  {
    id: 'luxury',
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

const OIL_GROUPS = (['hard', 'soft', 'butter', 'specialty', 'liquid'] as const)
  .map((category) => ({
    category,
    oils: OILS.filter((o) => o.category === category),
  }))
  .filter((group) => group.oils.length > 0)

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function additivePlaces(amountUnit: AdditiveAmountUnit): number {
  return amountUnit === 'tsp' || amountUnit === 'tbsp' ? 3 : 4
}

/** Map a quality value onto the track: the ideal band always sits 25–75%. */
function qualityBarPos(q: { value: number | null; min: number; max: number }): number {
  const span = q.max - q.min
  if (q.value == null || !(span > 0) || !Number.isFinite(q.value)) return 0
  const t = (q.value - q.min) / span
  return Math.max(0, Math.min(100, 25 + t * 50))
}

/** Build rows from weights against a fixed Total oils ceiling (not share-of-sum). */
function rowsFromWeightOils(oils: OilLine[], ceiling: number, locale: string): OilRow[] {
  const pcts = percentsFromOils(oils, ceiling > 0 ? ceiling : undefined)
  return oils.map((o, i) => ({
    key: uid(),
    oilId: o.oilId,
    amount: formatEditable(o.amount, locale, 4),
    pct: formatEditable(pcts[i]?.pct ?? 0, locale, 2),
  }))
}

/** Build rows from % of a fixed Total oils ceiling. */
function rowsFromPercentOils(
  lines: { oilId: string; pct: number }[],
  ceiling: number,
  locale: string,
): OilRow[] {
  const oils = oilsFromPercents(ceiling, lines)
  return oils.map((o, i) => ({
    key: uid(),
    oilId: o.oilId,
    amount: formatEditable(o.amount, locale, 4),
    pct: formatEditable(lines[i]?.pct ?? 0, locale, 2),
  }))
}

function parseAdditiveAmountUnit(
  value: string | undefined,
  fallback: SoapUnit,
): AdditiveAmountUnit {
  if (value === 'g' || value === 'oz' || value === 'lb' || value === 'tsp' || value === 'tbsp') {
    return value
  }
  return fallback
}

interface SoapCalculatorProps {
  onOpenWiki?: (articleId?: string) => void
  onToast?: ToastFn
}

export function SoapCalculator({ onOpenWiki, onToast }: SoapCalculatorProps) {
  const { t, intlLocale } = useI18n()

  const num = (raw: string): number => {
    const n = parseUserDecimal(raw, intlLocale)
    return Number.isFinite(n) ? n : NaN
  }
  const edit = (n: number, places = 2): string => formatEditable(n, intlLocale, places)
  const show = (n: number, places = 2): string => formatNumber(n, intlLocale, places)

  const defaults = defaultSoapInput()
  const defaultCeiling = defaults.oils.reduce((s, o) => s + o.amount, 0)
  const [rows, setRows] = useState<OilRow[]>(() =>
    rowsFromWeightOils(defaults.oils, defaultCeiling, intlLocale),
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
  const [totalOilsWeight, setTotalOilsWeight] = useState(() =>
    formatEditable(defaultCeiling, intlLocale, 4),
  )
  const [recipeName, setRecipeName] = useState('')
  const [recipeNotes, setRecipeNotes] = useState('')
  const [additiveRows, setAdditiveRows] = useState<AdditiveRow[]>([])
  const importRef = useRef<HTMLInputElement>(null)
  const prevLocaleRef = useRef(intlLocale)

  useEffect(() => {
    const prev = prevLocaleRef.current
    if (prev === intlLocale) return
    prevLocaleRef.current = intlLocale
    setRows((prevRows) =>
      prevRows.map((r) => ({
        ...r,
        amount: reformatEditable(r.amount, prev, intlLocale, 4),
        pct: reformatEditable(r.pct, prev, intlLocale, 2),
      })),
    )
    setTotalOilsWeight((raw) => reformatEditable(raw, prev, intlLocale, 4))
    setSuperfatPct((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setWaterAsPercentOfOils((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setLyeConcentrationPct((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setWaterDiscountPct((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setFragrancePct((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setAdditiveRows((prevRows) =>
      prevRows.map((r) => ({
        ...r,
        amount: reformatEditable(r.amount, prev, intlLocale, additivePlaces(r.amountUnit)),
      })),
    )
  }, [intlLocale])

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

  const u = t('unit.' + unit)

  // Locale edits replace this string; do not re-parse on intlLocale alone.
  const parsedTotalOils = useMemo(() => num(totalOilsWeight) || 0, [totalOilsWeight])

  const weightSum = useMemo(
    () =>
      rows.reduce((s, r) => {
        if (!r.oilId) return s
        const a = num(r.amount)
        return s + (Number.isFinite(a) && a > 0 ? a : 0)
      }, 0),
    [rows],
  )

  const pctSum = useMemo(
    () => sumOilPercents(rows.filter((r) => r.oilId).map((r) => num(r.pct) || 0)),
    [rows],
  )
  const pctOk = isPercentTotalLocked(pctSum)
  const pctDelta = Math.round((pctSum - 100) * 100) / 100

  /** Always use typed oil weights for lye math — ceiling only gates unlock. */
  const resolvedOils: OilLine[] = useMemo(() => {
    return rows
      .filter((r) => r.oilId)
      .map((r) => ({
        oilId: r.oilId,
        amount: num(r.amount) || 0,
      }))
  }, [rows])

  const weightsOk =
    parsedTotalOils > 0 &&
    weightsMatchCeiling(
      resolvedOils.map((r) => r.amount),
      parsedTotalOils,
    )
  const weightDelta = Math.round((weightSum - parsedTotalOils) * 10000) / 10000

  const input: SoapInput = useMemo(
    () => ({
      oils: resolvedOils,
      lyeType,
      superfatPct: num(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: num(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: num(lyeConcentrationPct) || 33,
      waterDiscountPct: num(waterDiscountPct) || 0,
      fragrancePct: num(fragrancePct) || 0,
      unit,
      additives: additiveRows
        .filter((r) => r.additiveId && (num(r.amount) || 0) > 0)
        .map((r) => ({
          additiveId: r.additiveId,
          amount: additiveAmountInRecipeUnit(num(r.amount) || 0, r.amountUnit, unit, r.additiveId),
        })),
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
      w.push(t('warn.needCeiling'))
    }
    if (!pctOk) {
      w.push(
        pctSum === 0
          ? t('warn.needOilPct')
          : t('warn.pctNot100', { pct: show(pctSum, 2) }),
      )
    } else if (!weightsOk) {
      w.push(
        t('warn.weightsOff', {
          ceiling: show(parsedTotalOils, 4),
          unit: u,
          weight: show(weightSum, 4),
        }),
      )
    }
    return w
  }, [parsedTotalOils, pctOk, pctSum, weightsOk, weightSum, u, t])

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
        const amount = num(amountStr)
        const pct =
          parsedTotalOils > 0 && Number.isFinite(amount)
            ? pctOfCeiling(amount > 0 ? amount : 0, parsedTotalOils)
            : 0
        return {
          ...r,
          amount: amountStr,
          pct: edit(pct, 2),
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
        const pct = num(pctStr)
        const amount =
          parsedTotalOils > 0 && Number.isFinite(pct)
            ? amountFromCeilingPct(pct > 0 ? pct : 0, parsedTotalOils)
            : 0
        return {
          ...r,
          pct: pctStr,
          amount: edit(amount, 4),
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
        amountUnit: unit,
      },
    ])
  }

  function updateAdditiveId(key: string, additiveId: string) {
    setAdditiveRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        // Keep the typed amount; if switching between spoon-capable additives the
        // spoon→weight factor changes with gPerTsp, which is intentional.
        return { ...r, additiveId }
      }),
    )
  }

  function updateAdditiveAmount(key: string, amountStr: string) {
    setAdditiveRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount: amountStr } : r)))
  }

  function updateAdditiveAmountUnit(key: string, nextUnit: AdditiveAmountUnit) {
    setAdditiveRows((prev) =>
      prev.map((r) => {
        if (r.key !== key || r.amountUnit === nextUnit) return r
        const n = num(r.amount)
        if (!Number.isFinite(n) || r.amount.trim() === '') {
          return { ...r, amountUnit: nextUnit }
        }
        const converted = convertAdditiveAmountUnit(n, r.amountUnit, nextUnit, r.additiveId)
        return {
          ...r,
          amountUnit: nextUnit,
          amount: edit(converted, additivePlaces(nextUnit)),
        }
      }),
    )
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
    setTotalOilsWeight(edit(total, 4))
    setRows(rowsFromWeightOils(converted, total, intlLocale))
    // Presets are oil-only formulas — drop leftover add-ins from the previous recipe.
    setAdditiveRows([])
    if (name) setRecipeName(name)
    // Preset is a new working copy — don't overwrite a previously loaded library slot.
    setActiveRecipeId(null)
    onToast?.(name ? t('toast.presetLoaded', { name }) : t('toast.presetGeneric'), 'ok')
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
    setTotalOilsWeight(edit(total, 4))
    setRecipeName(t('preset.custom'))
    setRecipeNotes('')
    setActiveRecipeId(null)
    setShowSaved(false)
    onToast?.(t('toast.customEmpty'), 'ok')
  }

  /**
   * User is changing the ceiling. Keep each oil's % of the old recipe and
   * recompute weights for the new total — only when they explicitly edit Total oils.
   * (Does not run when typing individual oil weights.)
   */
  function onTotalOilsChange(value: string) {
    const prevCeiling = parsedTotalOils
    const nextCeiling = num(value) || 0
    setTotalOilsWeight(value)
    if (!(nextCeiling > 0)) return
    setRows((prev) =>
      prev.map((r) => {
        const pct = num(r.pct)
        // Prefer stored % (stable across ceiling edits). Fall back to old weight/ceiling.
        let usePct = Number.isFinite(pct) ? pct : 0
        if (!(usePct > 0) && prevCeiling > 0) {
          const amt = num(r.amount) || 0
          usePct = pctOfCeiling(amt, prevCeiling)
        }
        return {
          ...r,
          pct: edit(usePct, 2),
          amount: edit(amountFromCeilingPct(usePct > 0 ? usePct : 0, nextCeiling), 4),
        }
      }),
    )
  }

  /** Optional: force every weight = % × ceiling (same as re-applying current %). */
  function applyPercentsToCeiling() {
    const target = num(totalOilsWeight)
    if (!target || target <= 0) {
      onToast?.(t('toast.needTotal'), 'warn')
      return
    }
    if (!pctOk) {
      onToast?.(t('toast.pctMust100'), 'warn')
      return
    }
    setRows((prev) =>
      prev.map((r) => {
        const pct = num(r.pct) || 0
        return {
          ...r,
          amount: edit(amountFromCeilingPct(pct, target), 4),
          pct: edit(pct, 2),
        }
      }),
    )
    onToast?.(t('toast.weightsSet'), 'ok')
  }

  /** Optional: scale current weights so they sum exactly to the ceiling (keeps ratios). */
  function scaleWeightsToCeiling() {
    const target = num(totalOilsWeight)
    if (!target || target <= 0) {
      onToast?.(t('toast.needTotal'), 'warn')
      return
    }
    const current = rows.reduce((s, r) => s + (num(r.amount) || 0), 0)
    if (!(current > 0)) {
      onToast?.(t('toast.needWeights'), 'warn')
      return
    }
    const factor = target / current
    setRows((prev) =>
      prev.map((r) => {
        const amount = (num(r.amount) || 0) * factor
        return {
          ...r,
          amount: edit(amount, 4),
          pct: edit(pctOfCeiling(amount, target), 2),
        }
      }),
    )
    onToast?.(t('toast.scaled', { amount: show(target, 4), unit: u }), 'ok')
  }

  function resetDefaults() {
    const d = defaultSoapInput()
    const total = d.oils.reduce((s, o) => s + o.amount, 0)
    setLyeType(d.lyeType)
    setSuperfatPct(edit(d.superfatPct, 2))
    setWaterMethod(d.waterMethod)
    setWaterAsPercentOfOils(edit(d.waterAsPercentOfOils, 2))
    setLyeConcentrationPct(edit(d.lyeConcentrationPct, 2))
    setWaterDiscountPct(edit(d.waterDiscountPct, 2))
    setFragrancePct(edit(d.fragrancePct, 2))
    setUnit(d.unit)
    setTotalOilsWeight(edit(total, 4))
    setRows(rowsFromWeightOils(d.oils, total, intlLocale))
    setRecipeName('')
    setRecipeNotes('')
    setAdditiveRows([])
    setActiveRecipeId(null)
    onToast?.(t('toast.soapReset'), 'ok')
  }

  function onUnitChange(next: SoapUnit) {
    if (next === unit) return
    const st = num(totalOilsWeight)
    const nextCeiling = Number.isFinite(st) && st > 0 ? convertWeight(st, unit, next) : 0
    setRows((prev) =>
      prev.map((r) => {
        const n = num(r.amount)
        if (!Number.isFinite(n)) return r
        const amount = convertWeight(n, unit, next)
        return {
          ...r,
          amount: edit(amount, 4),
          // % of ceiling is unit-invariant; recompute from converted mass for safety
          pct: edit(pctOfCeiling(amount, nextCeiling > 0 ? nextCeiling : 0), 2),
        }
      }),
    )
    // Weight-entered additives convert with the recipe unit; spoon amounts stay put.
    setAdditiveRows((prev) =>
      prev.map((r) => {
        if (isAdditiveVolumeUnit(r.amountUnit)) return r
        const n = num(r.amount)
        if (!Number.isFinite(n) || r.amount.trim() === '') {
          return { ...r, amountUnit: next }
        }
        return {
          ...r,
          amountUnit: next,
          amount: edit(convertWeight(n, r.amountUnit as SoapUnit, next), 4),
        }
      }),
    )
    if (nextCeiling > 0) {
      setTotalOilsWeight(edit(nextCeiling, 4))
    }
    setUnit(next)
  }

  function snapshotOils() {
    return rows
      .filter((r) => r.oilId)
      .map((r) => ({
        oilId: r.oilId,
        amount: num(r.amount) || 0,
        pct: num(r.pct) || 0,
      }))
  }

  function snapshotAdditives() {
    return additiveRows
      .filter((r) => r.additiveId && (num(r.amount) || 0) > 0)
      .map((r) => ({
        additiveId: r.additiveId,
        amount: num(r.amount) || 0,
        amountUnit: r.amountUnit,
      }))
  }

  function handleSave() {
    const recipe = persistSave({
      name: recipeName.trim(),
      oils: snapshotOils(),
      lyeType,
      superfatPct: num(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: num(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: num(lyeConcentrationPct) || 33,
      waterDiscountPct: num(waterDiscountPct) || 0,
      fragrancePct: num(fragrancePct) || 0,
      unit,
      oilEntryMode: 'dual',
      totalOilsWeight: parsedTotalOils > 0 ? parsedTotalOils : undefined,
      notes: recipeNotes.trim() || undefined,
      additives: snapshotAdditives(),
    })
    if (recipe) setRecipeName(recipe.name)
  }

  function loadRecipe(r: SavedSoapRecipe) {
    const nextUnit: SoapUnit = r.unit === 'g' || r.unit === 'lb' || r.unit === 'oz' ? r.unit : 'oz'
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
      nextRows = rowsFromPercentOils(lines, totalFromRecipe, intlLocale)
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
          amount: formatEditable(amount, intlLocale, 4),
          pct: formatEditable(pct, intlLocale, 2),
        }
      })
      // If amounts were empty but % exist, materialize weights from ceiling.
      if (
        totalFromRecipe > 0 &&
        nextRows.every((row) => !(num(row.amount) > 0)) &&
        nextRows.some((row) => num(row.pct) > 0)
      ) {
        nextRows = rowsFromPercentOils(
          nextRows.map((row) => ({ oilId: row.oilId, pct: num(row.pct) || 0 })),
          totalFromRecipe,
          intlLocale,
        )
      }
    }

    setTotalOilsWeight(
      totalFromRecipe > 0
        ? edit(totalFromRecipe, 4)
        : edit(unit === 'lb' ? 2 : unit === 'oz' ? 32 : 1000, 4),
    )
    setRows(nextRows)
    setLyeType(r.lyeType)
    setSuperfatPct(edit(r.superfatPct, 2))
    setWaterMethod(r.waterMethod)
    setWaterAsPercentOfOils(edit(r.waterAsPercentOfOils, 2))
    setLyeConcentrationPct(edit(r.lyeConcentrationPct, 2))
    setWaterDiscountPct(edit(r.waterDiscountPct, 2))
    setFragrancePct(edit(r.fragrancePct, 2))
    setUnit(nextUnit)
    setRecipeName(r.name)
    setRecipeNotes(r.notes || '')
    setAdditiveRows(
      (r.additives ?? []).map((a) => {
        const amountUnit = parseAdditiveAmountUnit(a.amountUnit, nextUnit)
        return {
          key: uid(),
          additiveId: a.additiveId,
          amount: edit(a.amount, additivePlaces(amountUnit)),
          amountUnit,
        }
      }),
    )
    setActiveRecipeId(r.id)
    setShowSaved(false)
    onToast?.(t('toast.loaded', { name: r.name }), 'ok')
  }

  function handleDelete(id: string) {
    removeSaved(id)
  }

  const currentSoapRecipe = useCallback((): SavedSoapRecipe => {
    return currentSoapSnapshot({
      id: activeRecipeId || undefined,
      name:
        recipeName.trim() ||
        t('recipe.defaultSoap', { date: new Date().toLocaleDateString(intlLocale) }),
      oils: snapshotOils(),
      lyeType,
      superfatPct: num(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: num(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: num(lyeConcentrationPct) || 33,
      waterDiscountPct: num(waterDiscountPct) || 0,
      fragrancePct: num(fragrancePct) || 0,
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
    t,
    intlLocale,
  ])

  const formatRecipeText = useCallback(() => {
    const lyeName = lyeType === 'naoh' ? 'NaOH' : 'KOH'
    const oilLines = rows
      .filter((r) => r.oilId)
      .map((r) => {
        const oil = getOil(r.oilId)
        const amt = num(r.amount) || 0
        const pct = num(r.pct) || 0
        return t('copy.oilLine', {
          name: oilDisplayName(t, r.oilId, oil?.name),
          amount: show(amt, 4),
          unit: u,
          pct: show(pct, 2),
        })
      })
    const additiveLines = additiveRows
      .filter((r) => r.additiveId && (num(r.amount) || 0) > 0)
      .map((r) => {
        const amt = num(r.amount) || 0
        const asRecipe = additiveAmountInRecipeUnit(amt, r.amountUnit, unit, r.additiveId)
        const spoonNote =
          isAdditiveVolumeUnit(r.amountUnit) && asRecipe > 0
            ? t('copy.spoonNote', { amount: show(asRecipe, 3), unit: u })
            : ''
        return (
          t('copy.additiveLine', {
            name: additiveDisplayName(t, r.additiveId, getAdditive(r.additiveId)?.name),
            amount: show(amt, 4),
            unit: t('unit.' + r.amountUnit),
          }) + spoonNote
        )
      })
    const warningBlock =
      result.warnings.length > 0
        ? t('copy.warnings', {
            text: result.warnings.map((w) => localizeRuntimeMessage(w, t, intlLocale)).join('\n'),
          })
        : ''
    const lines = [
      recipeName ? t('copy.soapTitleNamed', { name: recipeName }) : t('copy.soapTitle'),
      t('copy.unitLine', {
        unit: u,
        lye: lyeName,
        sf: show(num(superfatPct) || 0, 2),
        fo: show(num(fragrancePct) || 0, 2),
      }),
      t('copy.waterMethod', { method: t('water.' + waterMethod) }),
      t('copy.ceiling', {
        amount: show(parsedTotalOils || result.totalOils, 4),
        unit: u,
      }),
      t('copy.oilSum', {
        weight: show(weightSum, 4),
        unit: u,
        pct: show(pctSum, 2),
      }),
      '',
      t('copy.oilsHeader'),
      ...oilLines,
      ...(additiveLines.length > 0 ? ['', t('copy.additivesHeader'), ...additiveLines] : []),
      '',
      result.locked
        ? t('copy.locked')
        : [
            t('copy.totalOils', { amount: show(result.totalOils, 2), unit: u }),
            t('copy.lyeWithSf', {
              lye: lyeName,
              amount: show(result.lyeWithSuperfat, 2),
              unit: u,
            }),
            t('copy.pureLye', { amount: show(result.pureLye, 2), unit: u }),
            t('copy.water', { amount: show(result.water, 2), unit: u }),
            t('copy.lyeSolution', { amount: show(result.lyeSolution, 2), unit: u }),
            t('copy.fragrance', { amount: show(result.fragrance, 2), unit: u }),
            t('copy.batchTotal', { amount: show(result.totalBatch, 2), unit: u }),
            result.weightedIodine != null
              ? t('copy.iodine', { value: show(result.weightedIodine, 1) })
              : '',
            result.weightedIns != null ? t('copy.ins', { value: show(result.weightedIns, 1) }) : '',
          ]
            .filter(Boolean)
            .join('\n'),
      warningBlock,
      recipeNotes.trim() ? '\n' + t('copy.notes', { notes: recipeNotes.trim() }) : '',
      '',
      t('copy.ppe'),
    ]
    return lines.filter((x) => x !== '').join('\n')
  }, [
    recipeName,
    u,
    unit,
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
    t,
    intlLocale,
  ])

  async function handleCopy() {
    const ok = await copyText(formatRecipeText())
    onToast?.(ok ? t('toast.copied') : t('toast.copyFailed'), ok ? 'ok' : 'err')
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900')
    if (!w) {
      onToast?.(t('toast.popup'), 'err')
      return
    }
    const html =
      '<!doctype html><html><head><title>' +
      escapeHtml(t('print.soapTitle')) +
      '</title>' +
      '<style>' +
      'body{font-family:' +
      t('print.font') +
      ';padding:2rem;color:#1a0a2e;line-height:1.5}' +
      'h1{color:#6b21a8;font-size:1.4rem}' +
      'pre{white-space:pre-wrap;background:#f5e9ff;padding:1rem;border-radius:12px}' +
      '.note{font-size:0.85rem;color:#666;margin-top:1.5rem}' +
      '</style></head><body>' +
      '<h1>' +
      escapeHtml(t('print.soapH1')) +
      '</h1>' +
      '<pre>' +
      escapeHtml(formatRecipeText()) +
      '</pre>' +
      '<p class="note">' +
      escapeHtml(t('print.soapNote')) +
      '</p>' +
      '<script>onload=()=>{print();}</script>' +
      '</body></html>'
    w.document.write(html)
    w.document.close()
  }

  /** Load = pick a recipe/library file and merge into Saved (replaces Import). */
  async function handleLoadFile(file: File | null) {
    if (!file) return
    try {
      const loaded = await loadFromFile(file)
      if (!loaded) return
      const { parsed, merged } = loaded
      if (
        merged.lastSoap &&
        parsed.kind === 'soap' &&
        parsed.soapCount === 1 &&
        parsed.candleCount === 0
      ) {
        loadRecipe(merged.lastSoap)
      }
      onToast?.(
        localizeImportSummary(merged, t, intlLocale),
        importHasChanges(merged) ? 'ok' : 'warn',
      )
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
  const lyeToken = lyeType === 'naoh' ? 'NaOH' : 'KOH'

  return (
    <div className="calc-panel soap-panel">
      <header className="panel-head">
        <div>
          <h2>{t('soap.title')}</h2>
          <p className="muted">{t('soap.subtitle')}</p>
        </div>
        <div className="head-actions">
          <div className="unit-tabs" role="group" aria-label={t('unit.aria')}>
            {(['g', 'oz', 'lb'] as SoapUnit[]).map((opt) => (
              <button
                key={opt}
                type="button"
                className={'unit-tab' + (unit === opt ? ' active' : '')}
                onClick={() => onUnitChange(opt)}
              >
                {t('unit.' + opt)}
              </button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => onOpenWiki?.('app-soap-ui')}>
            {t('common.help')}
          </button>
          <button type="button" className="ghost" onClick={resetDefaults}>
            {t('common.reset')}
          </button>
        </div>
      </header>

      <section className="card toolbar-card">
        <div className="toolbar-row">
          <label className="grow">
            {t('common.recipeName')}
            <input
              type="text"
              placeholder={t('soap.placeholder')}
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              maxLength={120}
            />
          </label>
          <div className="toolbar-btns">
            <button type="button" className="chip solid" onClick={handleSave}>
              {activeRecipeId ? t('common.update') : t('common.save')}
            </button>
            <button type="button" className="chip" onClick={() => setShowSaved((v) => !v)}>
              {showSaved ? t('common.hideSaved') : t('common.savedCount', { n: saved.length })}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => importRef.current?.click()}
              title={t('common.loadTitle')}
            >
              {t('common.load')}
            </button>
            <button
              type="button"
              className="chip"
              onClick={handleShare}
              onContextMenu={(e) => {
                e.preventDefault()
                void handleShareLibrary()
              }}
              title={t('common.shareTitle')}
            >
              {t('common.share')}
            </button>
            <button
              type="button"
              className="chip"
              onClick={handleCopy}
              title={t('common.copyBatchTitle')}
            >
              {t('common.copy')}
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              {t('common.print')}
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept={RECIPE_FILE_ACCEPT}
            className="sr-only"
            aria-label={t('common.loadFileAria')}
            onChange={(e) => void handleLoadFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <label className="notes-field">
          {t('common.customNotes')}
          <textarea
            rows={3}
            maxLength={4000}
            placeholder={t('soap.notesPlaceholder')}
            value={recipeNotes}
            onChange={(e) => setRecipeNotes(e.target.value)}
          />
        </label>
        {activeRecipeId && <p className="hint recipe-slot-hint">{t('common.editingSlot')}</p>}
        {showSaved && (
          <div className="saved-list">
            {saved.length === 0 && <p className="hint">{t('soap.noSaved')}</p>}
            {saved.length > 0 && (
              <div className="saved-list-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => void handleShareLibrary()}
                  title={t('common.shareLibraryTitle')}
                >
                  {t('common.shareLibrary')}
                </button>
              </div>
            )}
            {saved.map((r) => {
              const savedAt = formatSavedAt(r.savedAt, intlLocale)
              return (
                <div
                  key={r.id}
                  className={'saved-item' + (r.id === activeRecipeId ? ' active' : '')}
                  aria-current={r.id === activeRecipeId ? 'true' : undefined}
                >
                  <button type="button" className="saved-load" onClick={() => loadRecipe(r)}>
                    <strong>{r.name}</strong>
                    <span>
                      {t('soap.savedMeta', {
                        count: show(r.oils.length, 0),
                        lye: r.lyeType === 'koh' ? 'KOH' : 'NaOH',
                        sf: show(r.superfatPct, 2),
                      })}
                      {r.totalOilsWeight != null
                        ? ` · ${show(r.totalOilsWeight, 2)} ${t('unit.' + r.unit)}`
                        : ''}
                      {savedAt ? ` · ${savedAt}` : ''}
                    </span>
                    {r.notes ? <span className="notes-chip">{t('common.notes')}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('common.deleteAria', { name: r.name })}
                    onClick={() => handleDelete(r.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card weight-of-oils-card">
        <div className="card-title-row">
          <h3>{t('soap.weightOfOils')}</h3>
          <span className="ceiling-badge" title={t('soap.ceilingTitle')}>
            {t('soap.ceiling')}
          </span>
        </div>

        <div className="total-oils-row">
          <label className="grow">
            {t('soap.totalOilsWeight', { unit: u })}
            <input
              type="text"
              min="0"
              step="any"
              inputMode="decimal"
              autoComplete="off"
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
              title={t('soap.scaleTitle')}
            >
              {t('soap.scale')}
            </button>
            <button
              type="button"
              className="chip"
              onClick={applyPercentsToCeiling}
              title={t('soap.applyPctTitle')}
            >
              {t('soap.applyPct')}
            </button>
          </div>
          <p className="hint full">
            <RichText text={t('soap.ceilingHint')} />
          </p>
        </div>

        <div className="card-title-row oils-subhead">
          <h3>{t('soap.oilsButters')}</h3>
          <div className="preset-row" role="group" aria-label={t('soap.presetsAria')}>
            <button
              type="button"
              className="chip solid custom-recipe-btn"
              onClick={startCustomRecipe}
              title={t('preset.customTitle')}
            >
              {t('preset.custom')}
            </button>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => applyPreset(p.oils, t('preset.' + p.id))}
              >
                {t('preset.' + p.id)}
              </button>
            ))}
          </div>
        </div>

        <div className="oil-table mode-dual">
          <div className="oil-head">
            <span>{t('soap.colOil')}</span>
            <span>{t('soap.colWeight', { unit: u })}</span>
            <span>{t('soap.colPct')}</span>
            <span />
          </div>
          {rows.length === 0 && (
            <div className="oil-empty-state">
              <p>{t('soap.noOils')}</p>
              <button type="button" className="chip solid" onClick={addRow}>
                {t('soap.addFirst')}
              </button>
            </div>
          )}
          {rows.map((row) => {
            const oil = getOil(row.oilId)
            const oilName = oil ? oilDisplayName(t, oil.id, oil.name) : ''
            const oilNotes = oil?.notes ? tx(t, `oil.${oil.id}.notes`, oil.notes) : ''
            const linePctNum = num(row.pct) || 0
            const overMax = oil?.maxPct != null && linePctNum > 0 && linePctNum > oil.maxPct + 0.05
            return (
              <div className="oil-row" key={row.key}>
                <div className="oil-select-wrap">
                  <select
                    value={row.oilId}
                    onChange={(e) => updateRowOil(row.key, e.target.value)}
                    aria-label={t('soap.selectOilAria')}
                  >
                    <option value="">{t('soap.selectOil')}</option>
                    {OIL_GROUPS.map((group) => (
                      <optgroup key={group.category} label={t('oilCat.' + group.category)}>
                        {group.oils.map((o) => (
                          <option key={o.id} value={o.id}>
                            {oilDisplayName(t, o.id, o.name)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="info-chip"
                    title={oilNotes || t('soap.oilInfo')}
                    aria-label={t('soap.wikiAria', { name: oilName || t('tag.oil') })}
                    disabled={!row.oilId}
                    onClick={() => row.oilId && onOpenWiki?.('oil-' + row.oilId)}
                  >
                    i
                  </button>
                </div>
                <input
                  type="text"
                  className="weight-input"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  autoComplete="off"
                  value={row.amount}
                  onChange={(e) => updateRowWeight(row.key, e.target.value)}
                  aria-label={t('soap.weightAria', { name: oilName })}
                />
                <div className="pct-input-wrap">
                  <input
                    type="text"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    autoComplete="off"
                    className={'pct-input' + (overMax ? ' warn-input' : '')}
                    value={row.pct}
                    onChange={(e) => updateRowPct(row.key, e.target.value)}
                    aria-label={t('soap.pctAria', { name: oilName })}
                  />
                  <span className="pct-suffix">%</span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('soap.removeOil')}
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
            {t('soap.addOil')}
          </button>
          <div className={pctStatusClass} role="status">
            <span>
              {t('soap.oilPct')} <strong>{show(pctSum, 2)}%</strong>
              {' · '}
              {t('soap.weights')}{' '}
              <strong>
                {show(weightSum, 4)} {u}
              </strong>
              {' / '}
              <strong>
                {show(parsedTotalOils, 4)} {u}
              </strong>
            </span>
            <span className="pct-hint">
              {recipeBalanced
                ? t('soap.statusUnlocked')
                : !parsedTotalOils
                  ? t('soap.statusSetCeiling')
                  : !pctOk
                    ? pctDelta > 0
                      ? t('soap.statusPctOver', { pct: show(pctDelta, 2) })
                      : t('soap.statusPctShort', { pct: show(Math.abs(pctDelta), 2) })
                    : weightDelta > 0
                      ? t('soap.statusWeightOver', { amount: show(weightDelta, 4), unit: u })
                      : t('soap.statusWeightUnder', {
                          amount: show(Math.abs(weightDelta), 4),
                          unit: u,
                        })}
            </span>
          </div>
        </div>
      </section>

      <section className="card additives-card">
        <div className="card-title-row">
          <h3>{t('soap.additivesTitle')}</h3>
          <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-additives')}>
            {t('soap.additiveGuide')}
          </button>
        </div>
        <p className="hint">{t('soap.additivesHint', { unit: u })}</p>
        {additiveRows.length === 0 && <p className="hint">{t('soap.noAdditives')}</p>}
        {additiveRows.map((row) => {
          const add = getAdditive(row.additiveId)
          const addName = add ? additiveDisplayName(t, add.id, add.name) : ''
          const addBenefits = add ? tx(t, `additive.${add.id}.benefits`, add.benefits) : ''
          const addCautions = add?.cautions ? tx(t, `additive.${add.id}.cautions`, add.cautions) : ''
          const addPhase = add ? tx(t, `additive.${add.id}.phase`, add.phase) : ''
          const addPpo = add?.ppo ? tx(t, `additive.${add.id}.ppo`, add.ppo) : ''
          const amt = num(row.amount) || 0
          const amtInRecipe =
            row.additiveId && amt > 0
              ? additiveAmountInRecipeUnit(amt, row.amountUnit, unit, row.additiveId)
              : 0
          const pctOfOils =
            parsedTotalOils > 0 && amtInRecipe > 0 ? (amtInRecipe / parsedTotalOils) * 100 : 0
          const usage = add ? additiveUsageStatus(pctOfOils, add.usagePct) : 'n/a'
          const usageCls = usage === 'good' ? 'ok' : usage
          const range = {
            min: show(add?.usagePct.min ?? 0, 2),
            max: show(add?.usagePct.max ?? 0, 2),
          }
          const usageLabel =
            usage === 'good'
              ? t('soap.usageOk', range)
              : usage === 'low'
                ? t('soap.usageLow', range)
                : usage === 'high'
                  ? t('soap.usageHigh', { max: range.max })
                  : t('common.dash')
          const usageTitle =
            usage === 'good'
              ? t('soap.usageWithin', range)
              : usage === 'low'
                ? t('soap.usageBelow', range)
                : usage === 'high'
                  ? t('soap.usageAbove', range)
                  : t('soap.usageEnter')
          const metaBits = [
            addPpo ? t('soap.ppo', { ppo: addPpo }) : null,
            addPhase || null,
            amtInRecipe > 0 && isAdditiveVolumeUnit(row.amountUnit)
              ? t('soap.approx', { amount: show(amtInRecipe, 3), unit: u })
              : null,
            pctOfOils > 0 ? t('soap.ofOils', { pct: show(pctOfOils, 2) }) : null,
          ].filter(Boolean)
          return (
            <div className="additive-row" key={row.key}>
              <div className="additive-select-wrap">
                <select
                  value={row.additiveId}
                  onChange={(e) => updateAdditiveId(row.key, e.target.value)}
                  aria-label={t('soap.selectAdditiveAria')}
                >
                  <option value="">{t('soap.selectAdditive')}</option>
                  {Object.entries(ADDITIVE_CATEGORY_LABELS).map(([cat]) => (
                    <optgroup key={cat} label={t('additiveCat.' + cat)}>
                      {ADDITIVES.filter((a) => a.category === cat).map((a) => (
                        <option key={a.id} value={a.id}>
                          {t('soap.additiveOption', {
                            name: additiveDisplayName(t, a.id, a.name),
                            min: show(a.usagePct.min, 2),
                            max: show(a.usagePct.max, 2),
                          })}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  className="info-chip"
                  title={addBenefits || t('soap.additiveInfo')}
                  aria-label={t('soap.wikiAria', { name: addName || t('soap.additiveInfo') })}
                  disabled={!row.additiveId}
                  onClick={() => row.additiveId && onOpenWiki?.('soap-additives')}
                >
                  i
                </button>
              </div>
              <div className="pct-input-wrap additive-amount-wrap">
                <input
                  type="text"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  autoComplete="off"
                  className="weight-input"
                  value={row.amount}
                  onChange={(e) => updateAdditiveAmount(row.key, e.target.value)}
                  aria-label={t('soap.amountAria', { name: addName })}
                  placeholder="0"
                />
                <select
                  className="additive-unit-select"
                  value={row.amountUnit}
                  onChange={(e) =>
                    updateAdditiveAmountUnit(row.key, e.target.value as AdditiveAmountUnit)
                  }
                  aria-label={t('soap.unitAria', { name: addName || t('soap.additiveInfo') })}
                >
                  <option value={unit}>{t('unit.' + unit)}</option>
                  {unit !== 'g' && <option value="g">{t('unit.g')}</option>}
                  {unit !== 'oz' && <option value="oz">{t('unit.oz')}</option>}
                  {unit !== 'lb' && <option value="lb">{t('unit.lb')}</option>}
                  <option value="tsp">{t('unit.tsp')}</option>
                  <option value="tbsp">{t('unit.tbsp')}</option>
                </select>
              </div>
              <span className={'additive-status ' + usageCls} title={usageTitle}>
                {usageLabel}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('soap.removeAdditive')}
                onClick={() => removeAdditiveRow(row.key)}
              >
                ×
              </button>
              {metaBits.length > 0 && (
                <p className="additive-meta" title={addCautions || addBenefits || undefined}>
                  {metaBits.join(' · ')}
                </p>
              )}
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
            aria-label={t('soap.addAdditiveAria')}
          >
            <option value="">{t('soap.addAdditivePlaceholder')}</option>
            {Object.entries(ADDITIVE_CATEGORY_LABELS).map(([cat]) => (
              <optgroup key={cat} label={t('additiveCat.' + cat)}>
                {ADDITIVES.filter((a) => a.category === cat).map((a) => (
                  <option key={a.id} value={a.id}>
                    {t('soap.additiveOption', {
                      name: additiveDisplayName(t, a.id, a.name),
                      min: show(a.usagePct.min, 2),
                      max: show(a.usagePct.max, 2),
                    })}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="add-btn" onClick={() => addAdditiveRow()}>
            {t('soap.addAdditive')}
          </button>
        </div>
      </section>

      <div className="split-grid">
        <section className="card">
          <h3>{t('soap.lyeSuperfat')}</h3>
          <div className="field-grid">
            <label>
              {t('soap.lyeType')}
              <select value={lyeType} onChange={(e) => setLyeType(e.target.value as LyeType)}>
                <option value="naoh">{t('lye.naoh')}</option>
                <option value="koh">{t('lye.koh')}</option>
              </select>
            </label>
            <label>
              {t('soap.superfatPct')}
              <input
                type="text"
                min="0"
                max="20"
                step="0.5"
                inputMode="decimal"
                autoComplete="off"
                value={superfatPct}
                onChange={(e) => setSuperfatPct(e.target.value)}
              />
            </label>
            <label>
              {t('soap.foPctOils')}
              <input
                type="text"
                min="0"
                max="10"
                step="0.1"
                inputMode="decimal"
                autoComplete="off"
                value={fragrancePct}
                onChange={(e) => setFragrancePct(e.target.value)}
              />
            </label>
            <p className="hint full">
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-superfat')}>
                {t('soap.superfatGuide')}
              </button>
              {' · '}
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-lye-safety')}>
                {t('soap.lyeSafety')}
              </button>
            </p>
          </div>
        </section>

        <section className="card">
          <h3>{t('soap.water')}</h3>
          <div className="field-grid">
            <label className="full">
              {t('soap.method')}
              <select
                value={waterMethod}
                onChange={(e) => setWaterMethod(e.target.value as WaterMethod)}
              >
                <option value="percent_oils">{t('water.percent_oils')}</option>
                <option value="lye_concentration">{t('water.lye_concentration')}</option>
                <option value="discount">{t('water.discount')}</option>
              </select>
            </label>
            {waterMethod === 'percent_oils' && (
              <label>
                {t('soap.waterPctLabel')}
                <input
                  type="text"
                  min="20"
                  max="45"
                  step="0.5"
                  inputMode="decimal"
                  autoComplete="off"
                  value={waterAsPercentOfOils}
                  onChange={(e) => setWaterAsPercentOfOils(e.target.value)}
                />
              </label>
            )}
            {waterMethod === 'lye_concentration' && (
              <label>
                {t('soap.lyeConcLabel')}
                <input
                  type="text"
                  min="25"
                  max="50"
                  step="0.5"
                  inputMode="decimal"
                  autoComplete="off"
                  value={lyeConcentrationPct}
                  onChange={(e) => setLyeConcentrationPct(e.target.value)}
                />
              </label>
            )}
            {waterMethod === 'discount' && (
              <label>
                {t('soap.waterDiscountLabel')}
                <input
                  type="text"
                  min="0"
                  max="40"
                  step="1"
                  inputMode="decimal"
                  autoComplete="off"
                  value={waterDiscountPct}
                  onChange={(e) => setWaterDiscountPct(e.target.value)}
                />
              </label>
            )}
            <p className="hint full">
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-water')}>
                {t('soap.waterMethods')}
              </button>
            </p>
          </div>
        </section>
      </div>

      <section className={'card results-card' + (result.locked ? ' results-locked' : '')}>
        <div className="card-title-row">
          <h3>{t('soap.batchResults')}</h3>
          <div className="toolbar-btns">
            <button type="button" className="chip" onClick={handleCopy} disabled={!!result.locked}>
              {t('common.copyResults')}
            </button>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <ul className="warnings">
            {result.warnings.map((w) => (
              <li key={w}>{localizeRuntimeMessage(w, t, intlLocale)}</li>
            ))}
          </ul>
        )}
        <div className="stat-grid">
          <div className="stat hero">
            <span className="stat-label">{t('soap.lyeWithSf', { lye: lyeToken })}</span>
            <span className="stat-value">
              {result.locked ? t('common.dash') : show(result.lyeWithSuperfat, 2)}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('soap.water')}</span>
            <span className="stat-value">
              {result.locked ? t('common.dash') : show(result.water, 2)}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('soap.lyeSolution')}</span>
            <span className="stat-value">
              {result.locked ? t('common.dash') : show(result.lyeSolution, 2)}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('soap.fragrance')}</span>
            <span className="stat-value">
              {result.locked ? t('common.dash') : show(result.fragrance, 2)}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('soap.totalOils')}</span>
            <span className="stat-value">
              {result.locked ? show(parsedTotalOils, 2) : show(result.totalOils, 2)}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('soap.batchTotal')}</span>
            <span className="stat-value">
              {result.locked ? t('common.dash') : show(result.totalBatch, 2)}
              <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('soap.additives')}</span>
            <span className="stat-value">
              {result.locked ? t('common.dash') : show(result.additiveTotal, 2)}
              <small>{u}</small>
            </span>
          </div>
        </div>
        <div className="meta-row">
          <span>
            {t('soap.pureLyeLabel')}{' '}
            <strong>
              {result.locked ? t('common.dash') : show(result.pureLye, 2) + ' ' + u}
            </strong>
          </span>
          {result.weightedIodine != null && (
            <span>
              {t('soap.iodineLabel')} <strong>{show(result.weightedIodine, 1)}</strong>
            </span>
          )}
          {result.weightedIns != null && (
            <span>
              {t('soap.insLabel')} <strong>{show(result.weightedIns, 1)}</strong>
            </span>
          )}
        </div>
        {!result.locked && quality.length > 0 && (
          <div className="quality-panel">
            <div className="quality-head">
              <h4>{t('soap.quality')}</h4>
              <button
                type="button"
                className="linkish"
                onClick={() => onOpenWiki?.('soap-quality')}
              >
                {t('soap.howToRead')}
              </button>
            </div>
            <div className="quality-grid">
              {quality.map((q) => (
                <div key={q.key} className={'quality-metric ' + q.status}>
                  <div className="quality-top">
                    <span className="quality-label">{t('quality.' + q.key + '.label')}</span>
                    <span className="quality-value">
                      {q.value == null ? t('common.dash') : show(q.value, 1)}
                      <small>
                        {' '}
                        {t('soap.ideal', { min: show(q.min, 0), max: show(q.max, 0) })}
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
                          ? t('soap.inRange')
                          : q.status === 'low'
                            ? t('soap.belowIdeal')
                            : t('soap.aboveIdeal')
                      }
                    />
                  </div>
                  {q.status !== 'good' && (
                    <p className="quality-hint">{t('quality.' + q.key + '.hint')}</p>
                  )}
                </div>
              ))}
            </div>
            {satRatio != null && (
              <p className="quality-ratio">
                {t('soap.satRatio', {
                  sat: show(satRatio.sat, 0),
                  unsat: show(satRatio.unsat, 0),
                })}
              </p>
            )}
          </div>
        )}
        {!result.locked && result.oilBreakdown.length > 0 && (
          <div className="breakdown">
            <h4>{t('soap.oilBreakdown')}</h4>
            <ul>
              {result.oilBreakdown.map((b) => (
                <li key={b.oilId + b.name}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => onOpenWiki?.('oil-' + b.oilId)}
                  >
                    {oilDisplayName(t, b.oilId, b.name)}
                  </button>
                  <span>
                    {show(b.amount, 2)} {u} · {show(b.pct, 1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!result.locked && result.additives.length > 0 && (
          <div className="breakdown">
            <h4>{t('soap.additivesBreakdown')}</h4>
            <ul>
              {result.additives.map((a) => (
                <li key={a.additiveId}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => onOpenWiki?.('soap-additives')}
                  >
                    {additiveDisplayName(t, a.additiveId, a.name)}
                  </button>
                  <span
                    className={'additive-status ' + a.status}
                    title={
                      a.status === 'ok'
                        ? t('soap.withinShort', {
                            min: show(a.usageMin, 2),
                            max: show(a.usageMax, 2),
                          })
                        : a.status === 'low'
                          ? t('soap.usageBelow', {
                              min: show(a.usageMin, 2),
                              max: show(a.usageMax, 2),
                            })
                          : t('soap.usageAbove', {
                              min: show(a.usageMin, 2),
                              max: show(a.usageMax, 2),
                            })
                    }
                  >
                    {show(a.amount, 2)} {u} · {show(a.pctOfOils, 2)}% ·{' '}
                    {a.status === 'ok'
                      ? t('soap.okShort', {
                          min: show(a.usageMin, 2),
                          max: show(a.usageMax, 2),
                        })
                      : a.status === 'low'
                        ? t('soap.lowShort', {
                            min: show(a.usageMin, 2),
                            max: show(a.usageMax, 2),
                          })
                        : t('soap.highShort', { max: show(a.usageMax, 2) })}
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
