import { useCallback, useMemo, useRef, useState } from 'react'
import { OILS, getOil } from '../data/oils'
import {
  calculateSoap,
  defaultSoapInput,
  type OilLine,
  type SoapInput,
  type WaterMethod,
  type LyeType,
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

interface SoapCalculatorProps {
  onOpenWiki?: (articleId?: string) => void
  onToast?: (msg: string) => void
}

export function SoapCalculator({ onOpenWiki, onToast }: SoapCalculatorProps) {
  const [rows, setRows] = useState<{ key: string; oilId: string; amount: string }[]>([
    { key: uid(), oilId: 'olive', amount: '400' },
    { key: uid(), oilId: 'coconut', amount: '250' },
    { key: uid(), oilId: 'palm', amount: '250' },
    { key: uid(), oilId: 'castor', amount: '100' },
  ])
  const [lyeType, setLyeType] = useState<LyeType>('naoh')
  const [superfatPct, setSuperfatPct] = useState('5')
  const [waterMethod, setWaterMethod] = useState<WaterMethod>('percent_oils')
  const [waterAsPercentOfOils, setWaterAsPercentOfOils] = useState('33')
  const [lyeConcentrationPct, setLyeConcentrationPct] = useState('33')
  const [waterDiscountPct, setWaterDiscountPct] = useState('0')
  const [fragrancePct, setFragrancePct] = useState('3')
  const [unit, setUnit] = useState<'g' | 'oz'>('g')
  const [recipeName, setRecipeName] = useState('')
  const [saved, setSaved] = useState<SavedSoapRecipe[]>(() => listSoapRecipes())
  const [scaleTo, setScaleTo] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const input: SoapInput = useMemo(
    () => ({
      oils: rows.map((r) => ({
        oilId: r.oilId,
        amount: parseFloat(r.amount) || 0,
      })),
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
      rows,
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

  const result = useMemo(() => calculateSoap(input), [input])

  function updateRow(key: string, patch: Partial<{ oilId: string; amount: string }>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { key: uid(), oilId: 'olive', amount: '0' }])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  function applyPreset(oils: OilLine[]) {
    setRows(oils.map((o) => ({ key: uid(), oilId: o.oilId, amount: String(o.amount) })))
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
    applyPreset(d.oils)
    setRecipeName('')
    onToast?.('Soap calculator reset')
  }

  function scaleBatch() {
    const target = parseFloat(scaleTo)
    if (!target || target <= 0 || result.totalOils <= 0) {
      onToast?.('Enter a target total oils weight')
      return
    }
    const factor = target / result.totalOils
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        amount: String(Math.round((parseFloat(r.amount) || 0) * factor * 100) / 100),
      })),
    )
    onToast?.(`Scaled oils to ${target} ${unit}`)
  }

  function onUnitChange(next: 'g' | 'oz') {
    if (next === unit) return
    const factor = unit === 'g' && next === 'oz' ? 1 / 28.349523125 : 28.349523125
    setRows((prev) =>
      prev.map((r) => {
        const n = parseFloat(r.amount)
        if (!Number.isFinite(n)) return r
        return { ...r, amount: String(Math.round(n * factor * 100) / 100) }
      }),
    )
    const st = parseFloat(scaleTo)
    if (Number.isFinite(st) && st > 0) {
      setScaleTo(String(Math.round(st * factor * 100) / 100))
    }
    setUnit(next)
  }

  function handleSave() {
    const name = recipeName.trim() || `Soap ${new Date().toLocaleDateString()}`
    saveSoapRecipe({
      name,
      oils: rows.map((r) => ({ oilId: r.oilId, amount: parseFloat(r.amount) || 0 })),
      lyeType,
      superfatPct: parseFloat(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: parseFloat(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: parseFloat(lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(waterDiscountPct) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      unit,
    })
    setSaved(listSoapRecipes())
    setRecipeName(name)
    onToast?.(`Saved “${name}”`)
  }

  function loadRecipe(r: SavedSoapRecipe) {
    setRows(r.oils.map((o) => ({ key: uid(), oilId: o.oilId, amount: String(o.amount) })))
    setLyeType(r.lyeType)
    setSuperfatPct(String(r.superfatPct))
    setWaterMethod(r.waterMethod)
    setWaterAsPercentOfOils(String(r.waterAsPercentOfOils))
    setLyeConcentrationPct(String(r.lyeConcentrationPct))
    setWaterDiscountPct(String(r.waterDiscountPct))
    setFragrancePct(String(r.fragrancePct))
    setUnit(r.unit)
    setRecipeName(r.name)
    setShowSaved(false)
    onToast?.(`Loaded “${r.name}”`)
  }

  function handleDelete(id: string) {
    deleteSoapRecipe(id)
    setSaved(listSoapRecipes())
    onToast?.('Recipe deleted')
  }

  const currentSoapRecipe = useCallback((): SavedSoapRecipe => {
    return currentSoapSnapshot({
      name: recipeName.trim() || `Soap ${new Date().toLocaleDateString()}`,
      oils: rows.map((r) => ({ oilId: r.oilId, amount: parseFloat(r.amount) || 0 })),
      lyeType,
      superfatPct: parseFloat(superfatPct) || 0,
      waterMethod,
      waterAsPercentOfOils: parseFloat(waterAsPercentOfOils) || 0,
      lyeConcentrationPct: parseFloat(lyeConcentrationPct) || 33,
      waterDiscountPct: parseFloat(waterDiscountPct) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      unit,
    })
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
  ])

  const formatRecipeText = useCallback(() => {
    const lyeName = lyeType === 'naoh' ? 'NaOH' : 'KOH'
    const lines = [
      `Alex's Craft Calc — Soap Recipe${recipeName ? `: ${recipeName}` : ''}`,
      `Unit: ${unit} · Lye: ${lyeName} · Superfat: ${superfatPct}% · FO: ${fragrancePct}%`,
      `Water method: ${waterMethod}`,
      '',
      'Oils:',
      ...result.oilBreakdown.map((b) => `  • ${b.name}: ${b.amount} ${unit} (${b.pct}%)`),
      '',
      `Total oils: ${result.totalOils} ${unit}`,
      `${lyeName} (with SF): ${result.lyeWithSuperfat} ${unit}`,
      `Pure lye 0% SF: ${result.pureLye} ${unit}`,
      `Water: ${result.water} ${unit}`,
      `Lye solution: ${result.lyeSolution} ${unit}`,
      `Fragrance: ${result.fragrance} ${unit}`,
      `Batch total: ${result.totalBatch} ${unit}`,
      result.weightedIodine != null ? `Weighted iodine: ${result.weightedIodine}` : '',
      result.weightedIns != null ? `Weighted INS: ${result.weightedIns}` : '',
      '',
      'Always add lye to water. Wear PPE. Verify SAP with supplier COA.',
    ]
    return lines.filter(Boolean).join('\n')
  }, [
    recipeName,
    unit,
    lyeType,
    superfatPct,
    fragrancePct,
    waterMethod,
    result,
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
    const html = `<!doctype html><html><head><title>Soap Recipe</title>
      <style>
        body{font-family:Segoe UI,system-ui,sans-serif;padding:2rem;color:#1a0a2e;line-height:1.5}
        h1{color:#6b21a8;font-size:1.4rem}
        pre{white-space:pre-wrap;background:#f5e9ff;padding:1rem;border-radius:12px}
        .note{font-size:0.85rem;color:#666;margin-top:1.5rem}
      </style></head><body>
      <h1>Alex's Craft Calc — Soap</h1>
      <pre>${formatRecipeText().replace(/</g, '&lt;')}</pre>
      <p class="note">Craft planning only. Verify SAP values. Lye is caustic.</p>
      <script>onload=()=>{print();}</script>
      </body></html>`
    w.document.write(html)
    w.document.close()
  }

  function handleExportCurrent() {
    const recipe = currentSoapRecipe()
    downloadSharePack(exportSoapPack(recipe))
    onToast?.(`Exported “${recipe.name}” (.alex-soap.json)`)
  }

  function handleExportLibrary() {
    const pack = exportLibraryPack()
    const n = (pack.soap?.length || 0) + (pack.candle?.length || 0)
    if (n === 0) {
      onToast?.('No saved recipes to export')
      return
    }
    downloadSharePack(pack)
    onToast?.(`Exported library (${pack.soap?.length || 0} soap, ${pack.candle?.length || 0} candle)`)
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
      if (parsed.soap?.[0] && parsed.kind === 'soap' && parsed.soapCount === 1 && parsed.candleCount === 0) {
        loadRecipe(parsed.soap[0])
      }
      const merged = mergeImportedRecipes(parsed)
      setSaved(listSoapRecipes())
      const parts = [
        merged.soapSaved ? `${merged.soapSaved} soap` : null,
        merged.candleSaved ? `${merged.candleSaved} candle` : null,
      ].filter(Boolean)
      onToast?.(
        parts.length
          ? `Imported ${parts.join(' + ')} recipe${merged.soapSaved + merged.candleSaved === 1 ? '' : 's'}`
          : 'Nothing new to import',
      )
    } catch {
      onToast?.('Could not read that file')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const u = unit
  const hardnessHint =
    result.weightedIns != null
      ? result.weightedIns >= 160
        ? 'Firm / fast-hardening tendency'
        : result.weightedIns >= 120
          ? 'Balanced bar body'
          : 'Softer / slower-hardening tendency'
      : null

  return (
    <div className="calc-panel soap-panel">
      <header className="panel-head">
        <div>
          <h2>Soap Calculator</h2>
          <p className="muted">Cold-process lye, water & fragrance — live as you type.</p>
        </div>
        <div className="head-actions">
          <label className="seg">
            <span className="sr-only">Unit</span>
            <select value={unit} onChange={(e) => onUnitChange(e.target.value as 'g' | 'oz')}>
              <option value="g">grams</option>
              <option value="oz">ounces</option>
            </select>
          </label>
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
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete ${r.name}`}
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
          <h3>Oils & butters</h3>
          <div className="preset-row">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" className="chip" onClick={() => applyPreset(p.oils)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="oil-table">
          <div className="oil-head">
            <span>Oil</span>
            <span>Amount ({u})</span>
            <span className="hide-sm">%</span>
            <span />
          </div>
          {rows.map((row) => {
            const oil = getOil(row.oilId)
            const linePct =
              result.totalOils > 0
                ? (((parseFloat(row.amount) || 0) / result.totalOils) * 100).toFixed(1)
                : '—'
            const overMax =
              oil?.maxPct != null &&
              result.totalOils > 0 &&
              ((parseFloat(row.amount) || 0) / result.totalOils) * 100 > oil.maxPct + 0.05
            return (
              <div className="oil-row" key={row.key}>
                <div className="oil-select-wrap">
                  <select value={row.oilId} onChange={(e) => updateRow(row.key, { oilId: e.target.value })}>
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
                    aria-label={`Wiki: ${oil?.name || 'oil'}`}
                    onClick={() => onOpenWiki?.(`oil-${row.oilId}`)}
                  >
                    i
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                />
                <span className={`pct-cell hide-sm${overMax ? ' warn-text' : ''}`}>{linePct}%</span>
                <button type="button" className="icon-btn" aria-label="Remove oil" onClick={() => removeRow(row.key)}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
        <button type="button" className="add-btn" onClick={addRow}>
          + Add oil
        </button>

        <div className="scale-row">
          <label>
            Scale total oils to ({u})
            <input
              type="number"
              min="0"
              step="any"
              placeholder={result.totalOils ? String(result.totalOils) : '1000'}
              value={scaleTo}
              onChange={(e) => setScaleTo(e.target.value)}
            />
          </label>
          <button type="button" className="chip solid" onClick={scaleBatch}>
            Scale batch
          </button>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h3>Lye & superfat</h3>
          <div className="field-grid">
            <label>
              Lye type
              <select value={lyeType} onChange={(e) => setLyeType(e.target.value as LyeType)}>
                <option value="naoh">NaOH (bar soap)</option>
                <option value="koh">KOH (liquid soap)</option>
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
              <button type="button" className="linkish" onClick={() => onOpenWiki?.('soap-lye')}>
                Lye safety
              </button>
            </p>
          </div>
        </section>

        <section className="card">
          <h3>Water method</h3>
          <div className="field-grid">
            <label>
              Method
              <select value={waterMethod} onChange={(e) => setWaterMethod(e.target.value as WaterMethod)}>
                <option value="percent_oils">% of oils</option>
                <option value="lye_concentration">Lye concentration</option>
                <option value="discount">Water discount</option>
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

      <section className="card results-card">
        <div className="card-title-row">
          <h3>Batch results</h3>
          <div className="toolbar-btns">
            <button type="button" className="chip" onClick={handleCopy}>
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
            <span className="stat-label">{lyeType === 'naoh' ? 'NaOH' : 'KOH'} needed</span>
            <span className="stat-value">
              {result.lyeWithSuperfat} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Water</span>
            <span className="stat-value">
              {result.water} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Lye solution</span>
            <span className="stat-value">
              {result.lyeSolution} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Total oils</span>
            <span className="stat-value">
              {result.totalOils} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Fragrance</span>
            <span className="stat-value">
              {result.fragrance} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Batch total</span>
            <span className="stat-value">
              {result.totalBatch} <small>{u}</small>
            </span>
          </div>
        </div>

        <div className="meta-row">
          <span>
            Weighted iodine:{' '}
            <strong>{result.weightedIodine != null ? result.weightedIodine : '—'}</strong>
          </span>
          <span>
            Weighted INS: <strong>{result.weightedIns != null ? result.weightedIns : '—'}</strong>
          </span>
          <span>
            Pure lye (0% SF):{' '}
            <strong>
              {result.pureLye} {u}
            </strong>
          </span>
          {hardnessHint && (
            <span>
              Body: <strong>{hardnessHint}</strong>
            </span>
          )}
        </div>

        {result.oilBreakdown.length > 0 && (
          <div className="breakdown">
            <h4>Oil breakdown</h4>
            <table>
              <thead>
                <tr>
                  <th>Oil</th>
                  <th>Amount</th>
                  <th>%</th>
                  <th>SAP used</th>
                  <th className="hide-sm">Info</th>
                </tr>
              </thead>
              <tbody>
                {result.oilBreakdown.map((b) => (
                  <tr key={`${b.oilId}-${b.amount}-${b.pct}`}>
                    <td>{b.name}</td>
                    <td>
                      {b.amount} {u}
                    </td>
                    <td>{b.pct}%</td>
                    <td>{b.sapUsed.toFixed(4)}</td>
                    <td className="hide-sm">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => onOpenWiki?.(`oil-${b.oilId}`)}
                      >
                        wiki
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="disclaimer">
          Safety first: always add lye to water (never water to lye), wear PPE, and verify SAP values with your oil
          supplier. This tool is for craft planning — not a substitute for supplier COAs or lab testing.
        </p>
      </section>
    </div>
  )
}
