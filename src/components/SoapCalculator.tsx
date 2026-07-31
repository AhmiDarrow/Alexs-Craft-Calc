import { useCallback, useMemo, useRef, useState } from 'react'
import { OILS, getOil } from '../data/oils'
import {
  calculateSoap,
  convertWeight,
  defaultSoapInput,
  emptyLockedResult,
  isPercentTotalLocked,
  oilsFromPercents,
  percentsFromOils,
  sumOilPercents,
  type LyeType,
  type OilEntryMode,
  type OilLine,
  type SoapInput,
  type SoapUnit,
  type WaterMethod,
} from '../lib/soapCalc'
import {
  copyText,
  currentSoapSnapshot,
  deleteSoapRecipe,
  downloadSharePack,
  exportLibraryPack,
  exportSoapPack,
  importRecipesFromText,
  listSoapRecipes,
  mergeImportedRecipes,
  saveSoapRecipe,
  type SavedSoapRecipe,
} from '../lib/storage'

type OilRow = {
  key: string
  oilId: string
  amount: string
  pct: string
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

function rowsFromWeightOils(oils: OilLine[]): OilRow[] {
  const pcts = percentsFromOils(oils)
  return oils.map((o, i) => ({
    key: uid(),
    oilId: o.oilId,
    amount: String(o.amount),
    pct: fmtNum(pcts[i]?.pct ?? 0, 2),
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
  const [rows, setRows] = useState<OilRow[]>(() => rowsFromWeightOils(defaults.oils))
  const [lyeType, setLyeType] = useState<LyeType>('naoh')
  const [superfatPct, setSuperfatPct] = useState('5')
  const [waterMethod, setWaterMethod] = useState<WaterMethod>('percent_oils')
  const [waterAsPercentOfOils, setWaterAsPercentOfOils] = useState('33')
  const [lyeConcentrationPct, setLyeConcentrationPct] = useState('33')
  const [waterDiscountPct, setWaterDiscountPct] = useState('0')
  const [fragrancePct, setFragrancePct] = useState('3')
  const [unit, setUnit] = useState<SoapUnit>('oz')
  const [oilEntryMode, setOilEntryMode] = useState<OilEntryMode>('weight')
  const [totalOilsWeight, setTotalOilsWeight] = useState(() => {
    const d = defaultSoapInput()
    const total = d.oils.reduce((s, o) => s + o.amount, 0)
    return fmtNum(total, 4)
  })
  const [recipeName, setRecipeName] = useState('')
  const [recipeNotes, setRecipeNotes] = useState('')
  const [saved, setSaved] = useState<SavedSoapRecipe[]>(() => listSoapRecipes())
  const [showSaved, setShowSaved] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const u = unitLabel(unit)

  const parsedTotalOils = parseFloat(totalOilsWeight) || 0

  const pctSum = useMemo(
    () => sumOilPercents(rows.map((r) => parseFloat(r.pct) || 0)),
    [rows],
  )
  const pctOk = isPercentTotalLocked(pctSum)
  const pctDelta = Math.round((pctSum - 100) * 100) / 100

  const resolvedOils: OilLine[] = useMemo(() => {
    const picked = rows.filter((r) => r.oilId)
    if (oilEntryMode === 'percent') {
      if (!(parsedTotalOils > 0) || !pctOk) return []
      return oilsFromPercents(
        parsedTotalOils,
        picked.map((r) => ({ oilId: r.oilId, pct: parseFloat(r.pct) || 0 })),
      )
    }
    return picked.map((r) => ({
      oilId: r.oilId,
      amount: parseFloat(r.amount) || 0,
    }))
  }, [oilEntryMode, parsedTotalOils, pctOk, rows])

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
    ],
  )

  const lockWarnings = useMemo(() => {
    if (oilEntryMode !== 'percent') return [] as string[]
    const w: string[] = []
    if (!(parsedTotalOils > 0)) {
      w.push('Enter a Total oils weight before lye math can run in % mode.')
    }
    if (!pctOk) {
      w.push(
        pctSum === 0
          ? 'Enter oil percentages that total 100%.'
          : 'Oil percentages must total 100% before results unlock (currently ' +
              fmtNum(pctSum, 2) +
              '%).',
      )
    }
    return w
  }, [oilEntryMode, parsedTotalOils, pctOk, pctSum])

  const result = useMemo(() => {
    if (oilEntryMode === 'percent' && lockWarnings.length > 0) {
      return emptyLockedResult(lockWarnings)
    }
    return calculateSoap(input)
  }, [oilEntryMode, lockWarnings, input])

  const displayWeightTotal =
    oilEntryMode === 'weight'
      ? result.totalOils
      : parsedTotalOils > 0
        ? parsedTotalOils
        : 0

  function syncPctFromAmounts(nextRows: OilRow[]): OilRow[] {
    const oils = nextRows.map((r) => ({
      oilId: r.oilId,
      amount: parseFloat(r.amount) || 0,
    }))
    const pcts = percentsFromOils(oils)
    return nextRows.map((r, i) => ({
      ...r,
      pct: fmtNum(pcts[i]?.pct ?? 0, 2),
    }))
  }

  function syncAmountsFromPct(nextRows: OilRow[], total: number): OilRow[] {
    if (!(total > 0)) {
      return nextRows.map((r) => ({ ...r, amount: '0' }))
    }
    const oils = oilsFromPercents(
      total,
      nextRows.map((r) => ({ oilId: r.oilId, pct: parseFloat(r.pct) || 0 })),
    )
    return nextRows.map((r, i) => ({
      ...r,
      amount: fmtNum(oils[i]?.amount ?? 0, 4),
    }))
  }

  function updateRow(key: string, patch: Partial<OilRow>) {
    setRows((prev) => {
      let next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
      if (oilEntryMode === 'weight' && patch.amount !== undefined) {
        next = syncPctFromAmounts(next)
        const total = next.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        setTotalOilsWeight(total > 0 ? fmtNum(total, 4) : totalOilsWeight)
      } else if (oilEntryMode === 'percent' && patch.pct !== undefined) {
        next = syncAmountsFromPct(next, parsedTotalOils)
      } else if (patch.oilId !== undefined) {
        // oil change only
      }
      return next
    })
  }

  function addRow() {
    setRows((prev) => {
      const row: OilRow = {
        key: uid(),
        oilId: '',
        amount: '0',
        pct: '0',
      }
      const next = [...prev, row]
      return oilEntryMode === 'weight' ? syncPctFromAmounts(next) : next
    })
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key)
      if (oilEntryMode === 'weight') {
        const synced = syncPctFromAmounts(next)
        const total = synced.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
        if (total > 0) setTotalOilsWeight(fmtNum(total, 4))
        return synced
      }
      return syncAmountsFromPct(next, parsedTotalOils)
    })
  }

  function applyPreset(oils: OilLine[], name?: string) {
    // Presets are authored in grams; convert into the active unit (default oz).
    const converted = oils.map((o) => ({
      oilId: o.oilId,
      amount: convertWeight(o.amount, 'g', unit),
    }))
    const next = rowsFromWeightOils(converted)
    setRows(next)
    const total = converted.reduce((s, o) => s + o.amount, 0)
    setTotalOilsWeight(fmtNum(total, 4))
    if (name) setRecipeName(name)
    if (oilEntryMode === 'percent') {
      // keep % mode; amounts already derived from weights→pcts
      setRows(syncAmountsFromPct(next, total))
    }
    onToast?.(name ? name + ' loaded' : 'Preset loaded')
  }

  /**
   * True blank formula: no preset oils/butters preloaded.
   * Keeps unit, lye, water method, and total oils weight.
   */
  function startCustomRecipe() {
    const total =
      parsedTotalOils > 0 ? parsedTotalOils : unit === 'lb' ? 2 : unit === 'oz' ? 32 : 1000
    setRows([])
    setTotalOilsWeight(fmtNum(total, 4))
    setRecipeName('Custom')
    setRecipeNotes('')
    setShowSaved(false)
    onToast?.('Custom — empty recipe. Add oils and set weights or %')
  }

  function setEntryMode(mode: OilEntryMode) {
    if (mode === oilEntryMode) return
    if (mode === 'percent') {
      // Capture current weight total into dedicated field, keep % from weights
      const total =
        rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) ||
        parsedTotalOils ||
        1000
      const withPct = syncPctFromAmounts(rows)
      setTotalOilsWeight(fmtNum(total, 4))
      setRows(syncAmountsFromPct(withPct, total))
      setOilEntryMode('percent')
      onToast?.('Enter by % — oils must total 100%')
    } else {
      // Switch to weight: keep current amounts (from last good % or typed weights)
      let next = rows
      if (parsedTotalOils > 0 && pctOk) {
        next = syncAmountsFromPct(rows, parsedTotalOils)
      }
      next = syncPctFromAmounts(next)
      const total = next.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      if (total > 0) setTotalOilsWeight(fmtNum(total, 4))
      setRows(next)
      setOilEntryMode('weight')
      onToast?.('Enter by weight')
    }
  }

  function onTotalOilsChange(value: string) {
    setTotalOilsWeight(value)
    const total = parseFloat(value) || 0
    if (oilEntryMode === 'percent' && total > 0) {
      setRows((prev) => syncAmountsFromPct(prev, total))
    }
  }

  function applyTotalAsScale() {
    const target = parseFloat(totalOilsWeight)
    if (!target || target <= 0) {
      onToast?.('Enter a Total oils weight first')
      return
    }
    if (oilEntryMode === 'percent') {
      if (!pctOk) {
        onToast?.('Oil % must total 100% before applying total')
        return
      }
      setRows((prev) => syncAmountsFromPct(prev, target))
      onToast?.('Weights updated from % × total')
      return
    }
    const current = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (!(current > 0)) {
      onToast?.('Add oil weights before scaling')
      return
    }
    const factor = target / current
    setRows((prev) =>
      syncPctFromAmounts(
        prev.map((r) => ({
          ...r,
          amount: fmtNum((parseFloat(r.amount) || 0) * factor, 4),
        })),
      ),
    )
    onToast?.('Scaled oils to ' + target + ' ' + u)
  }

  function resetDefaults() {
    const d = defaultSoapInput()
    setLyeType(d.lyeType)
    setSuperfatPct(String(d.superfatPct))
    setWaterMethod(d.waterMethod)
    setWaterAsPercentOfOils(String(d.waterAsPercentOfOils))
    setLyeConcentrationPct(String(d.lyeConcentrationPct))
    setWaterDiscountPct(String(d.waterDiscountPct))
    setFragrancePct(String(d.fragrancePct))
    setUnit(d.unit)
    setOilEntryMode('weight')
    setRows(rowsFromWeightOils(d.oils))
    const total = d.oils.reduce((s, o) => s + o.amount, 0)
    setTotalOilsWeight(fmtNum(total, 4))
    setRecipeName('')
    setRecipeNotes('')
    onToast?.('Soap calculator reset')
  }

  function onUnitChange(next: SoapUnit) {
    if (next === unit) return
    setRows((prev) =>
      prev.map((r) => {
        const n = parseFloat(r.amount)
        if (!Number.isFinite(n)) return r
        return { ...r, amount: fmtNum(convertWeight(n, unit, next), 4) }
      }),
    )
    const st = parseFloat(totalOilsWeight)
    if (Number.isFinite(st) && st > 0) {
      setTotalOilsWeight(fmtNum(convertWeight(st, unit, next), 4))
    }
    setUnit(next)
  }

  function snapshotOils() {
    const picked = rows.filter((r) => r.oilId)
    if (oilEntryMode === 'percent') {
      const oils = oilsFromPercents(
        parsedTotalOils > 0 ? parsedTotalOils : 0,
        picked.map((r) => ({ oilId: r.oilId, pct: parseFloat(r.pct) || 0 })),
      )
      return oils.map((o, i) => ({
        oilId: o.oilId,
        amount: o.amount,
        pct: parseFloat(picked[i]?.pct) || 0,
      }))
    }
    return picked.map((r) => ({
      oilId: r.oilId,
      amount: parseFloat(r.amount) || 0,
      pct: parseFloat(r.pct) || 0,
    }))
  }

  function handleSave() {
    const name = recipeName.trim() || 'Soap ' + new Date().toLocaleDateString()
    saveSoapRecipe({
      name,
      oils: snapshotOils(),
      lyeType,
      superfatPct: parseFloat(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: parseFloat(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: parseFloat(lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(waterDiscountPct) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      unit,
      oilEntryMode,
      totalOilsWeight: parsedTotalOils > 0 ? parsedTotalOils : undefined,
      notes: recipeNotes.trim() || undefined,
    })
    setSaved(listSoapRecipes())
    setRecipeName(name)
    onToast?.('Saved “' + name + '”')
  }

  function loadRecipe(r: SavedSoapRecipe) {
    const mode: OilEntryMode = r.oilEntryMode === 'percent' ? 'percent' : 'weight'
    const nextUnit: SoapUnit =
      r.unit === 'g' || r.unit === 'lb' || r.unit === 'oz' ? r.unit : 'oz'
    let nextRows: OilRow[] = r.oils.map((o) => ({
      key: uid(),
      oilId: o.oilId,
      amount: String(o.amount),
      pct: o.pct != null ? fmtNum(o.pct, 2) : '0',
    }))
    if (mode === 'weight') {
      nextRows = syncPctFromAmounts(nextRows)
    } else if (nextRows.every((row) => !(parseFloat(row.pct) > 0))) {
      nextRows = syncPctFromAmounts(nextRows)
    }
    const totalFromRecipe =
      r.totalOilsWeight != null && r.totalOilsWeight > 0
        ? r.totalOilsWeight
        : nextRows.reduce((s, row) => s + (parseFloat(row.amount) || 0), 0)
    setTotalOilsWeight(totalFromRecipe > 0 ? fmtNum(totalFromRecipe, 4) : '1000')
    if (mode === 'percent' && totalFromRecipe > 0) {
      nextRows = syncAmountsFromPct(nextRows, totalFromRecipe)
    }
    setRows(nextRows)
    setOilEntryMode(mode)
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
    setShowSaved(false)
    onToast?.('Loaded “' + r.name + '”')
  }

  function handleDelete(id: string) {
    deleteSoapRecipe(id)
    setSaved(listSoapRecipes())
    onToast?.('Recipe deleted')
  }

  const currentSoapRecipe = useCallback((): SavedSoapRecipe => {
    return currentSoapSnapshot({
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
      oilEntryMode,
      totalOilsWeight: parsedTotalOils > 0 ? parsedTotalOils : undefined,
      notes: recipeNotes.trim() || undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
    oilEntryMode,
    parsedTotalOils,
    recipeNotes,
  ])

  const formatRecipeText = useCallback(() => {
    const lyeName = lyeType === 'naoh' ? 'NaOH' : 'KOH'
    const modeLabel = oilEntryMode === 'percent' ? 'by %' : 'by weight'
    const oilLines =
      oilEntryMode === 'percent'
        ? rows
            .filter((r) => r.oilId)
            .map((r) => {
              const oil = getOil(r.oilId)
              const amt = parseFloat(r.amount) || 0
              const pct = parseFloat(r.pct) || 0
              return '  • ' + (oil?.name || r.oilId) + ': ' + pct + '% → ' + fmtNum(amt, 4) + ' ' + u
            })
        : result.oilBreakdown.map(
            (b) => '  • ' + b.name + ': ' + b.amount + ' ' + u + ' (' + b.pct + '%)',
          )
    const lines = [
      "Alex's Craft Calc — Soap Recipe" + (recipeName ? ': ' + recipeName : ''),
      'Unit: ' + u + ' · Entry: ' + modeLabel + ' · Lye: ' + lyeName + ' · Superfat: ' + superfatPct + '% · FO: ' + fragrancePct + '%',
      'Water method: ' + waterMethod,
      'Total oils target: ' + (parsedTotalOils || result.totalOils) + ' ' + u,
      '',
      'Oils:',
      ...oilLines,
      '',
      result.locked
        ? 'Results locked — fix oil % total / total oils weight.'
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
          ].filter(Boolean).join('\n'),
      recipeNotes.trim() ? '\nNotes:\n' + recipeNotes.trim() : '',
      '',
      'Always add lye to water. Wear PPE. Verify SAP with supplier COA.',
    ]
    return lines.filter((x) => x !== '').join('\n')
  }, [
    recipeName,
    unit,
    u,
    lyeType,
    superfatPct,
    fragrancePct,
    waterMethod,
    result,
    oilEntryMode,
    rows,
    parsedTotalOils,
    recipeNotes,
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
      formatRecipeText().replace(/</g, '&lt;') +
      '</pre>' +
      '<p class="note">Craft planning only. Verify SAP values. Lye is caustic.</p>' +
      '<script>onload=()=>{print();}</script>' +
      '</body></html>'
    w.document.write(html)
    w.document.close()
  }

  function handleExportCurrent() {
    downloadSharePack(exportSoapPack(currentSoapRecipe()))
    onToast?.('Exported soap recipe')
  }

  function handleExportLibrary() {
    downloadSharePack(exportLibraryPack())
    onToast?.('Exported full recipe library')
  }

  async function handleImportFile(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = importRecipesFromText(text)
      if (!parsed.ok) {
        onToast?.(parsed.error)
        return
      }
      const { soapSaved, candleSaved } = mergeImportedRecipes(parsed)
      setSaved(listSoapRecipes())
      if (parsed.kind === 'soap' && parsed.soap?.[0]) {
        loadRecipe(parsed.soap[0])
      }
      onToast?.(
        'Imported ' +
          soapSaved +
          ' soap + ' +
          candleSaved +
          ' candle recipe(s)',
      )
    } catch {
      onToast?.('Import failed')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const pctStatusClass =
    oilEntryMode === 'percent'
      ? pctOk
        ? 'pct-status ok'
        : 'pct-status bad'
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
            />
          </label>
          <div className="toolbar-btns">
            <button type="button" className="chip solid" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="chip" onClick={() => setShowSaved((v) => !v)}>
              Load ({saved.length})
            </button>
            <button type="button" className="chip" onClick={handleCopy} title="Copy batch text">
              Copy
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              Print
            </button>
            <button type="button" className="chip" onClick={handleExportCurrent} title="Download .alex-soap.json">
              Export
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => importRef.current?.click()}
              title="Import recipe JSON"
            >
              Import
            </button>
            <button
              type="button"
              className="chip"
              onClick={handleExportLibrary}
              title="Export all saved soap + candle recipes"
            >
              Export all
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,.acc.json,application/json,text/plain"
            className="sr-only"
            aria-label="Import recipe file"
            onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <label className="notes-field">
          Custom recipe notes
          <textarea
            rows={3}
            placeholder="Batch notes, scent blend, colorants, cure log, mold, customer order…"
            value={recipeNotes}
            onChange={(e) => setRecipeNotes(e.target.value)}
          />
        </label>
        {showSaved && (
          <div className="saved-list">
            {saved.length === 0 && <p className="hint">No saved soap recipes yet.</p>}
            {saved.map((r) => (
              <div key={r.id} className="saved-item">
                <button type="button" className="saved-load" onClick={() => loadRecipe(r)}>
                  <strong>{r.name}</strong>
                  <span>
                    {r.oils.length} oils · {r.lyeType.toUpperCase()} ·{' '}
                    {new Date(r.savedAt).toLocaleDateString()}
                    {r.notes ? ' · notes' : ''}
                  </span>
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

      <section className="card">
        <div className="card-title-row">
          <h3>Weight of oils</h3>
          <div className="entry-mode-tabs" role="group" aria-label="Oil entry mode">
            <button
              type="button"
              className={'unit-tab' + (oilEntryMode === 'weight' ? ' active' : '')}
              onClick={() => setEntryMode('weight')}
            >
              By weight
            </button>
            <button
              type="button"
              className={'unit-tab' + (oilEntryMode === 'percent' ? ' active' : '')}
              onClick={() => setEntryMode('percent')}
            >
              By %
            </button>
          </div>
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
          <button type="button" className="chip solid" onClick={applyTotalAsScale}>
            {oilEntryMode === 'percent' ? 'Apply to weights' : 'Scale oils to total'}
          </button>
          <p className="hint full">
            Set the combined oil batch size here. In <strong>By %</strong> mode this total drives every oil weight.
            In <strong>By weight</strong> mode, typing oils updates the live % column; use Scale to hit this total.
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

        <div className={'oil-table' + (oilEntryMode === 'percent' ? ' mode-percent' : ' mode-weight')}>
          <div className="oil-head">
            <span>Oil</span>
            <span>Weight ({u})</span>
            <span>%</span>
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
                    onChange={(e) => updateRow(row.key, { oilId: e.target.value })}
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
                  disabled={oilEntryMode === 'percent'}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
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
                    disabled={oilEntryMode === 'weight'}
                    onChange={(e) => updateRow(row.key, { pct: e.target.value })}
                    aria-label={'Percent ' + (oil?.name || '')}
                  />
                  <span className="pct-suffix">%</span>
                </div>
                <button type="button" className="icon-btn" aria-label="Remove oil" onClick={() => removeRow(row.key)}>
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
              Oil % total: <strong>{fmtNum(pctSum, 2)}%</strong>
            </span>
            {oilEntryMode === 'percent' && (
              <span className="pct-hint">
                {pctOk
                  ? 'Unlocked — results live'
                  : pctDelta === 0
                    ? 'Need 100%'
                    : pctDelta > 0
                      ? fmtNum(pctDelta, 2) + '% over — lock until 100%'
                      : fmtNum(Math.abs(pctDelta), 2) + '% short — lock until 100%'}
              </span>
            )}
            {oilEntryMode === 'weight' && (
              <span className="pct-hint muted-inline">
                Live from weights · batch {fmtNum(displayWeightTotal, 2)} {u}
              </span>
            )}
          </div>
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
      </section>
    </div>
  )
}
